// lumaSession's callerIdentity holds the caller by the broker's pidfd: a
// live caller is identified; a caller that exits mid-check, or whose pid is
// taken by another process (pid reuse), is refused; one whose details can't
// be read is refused on purpose; a broker without ProcessFD still answers.
// Writes CALLER_OUT.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {callerIdentity} from 'resource:///org/gnome/shell/ui/lumaSession.js';

const out = GLib.getenv('CALLER_OUT');
const lines = [];
const sleep = ms => new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { r(); return GLib.SOURCE_REMOVE; }));
const HELPER = 'import gi\nfrom gi.repository import Gio\nimport time\n' +
    'bus = Gio.bus_get_sync(Gio.BusType.SESSION)\nprint(bus.get_unique_name(), flush=True)\ntime.sleep(120)\n';

async function caller() {
    const proc = Gio.Subprocess.new(['python3', '-c', HELPER], Gio.SubprocessFlags.STDOUT_PIPE);
    const stdout = new Gio.DataInputStream({base_stream: proc.get_stdout_pipe()});
    const [line] = await new Promise((resolve, reject) => stdout.read_line_async(GLib.PRIORITY_DEFAULT, null,
        (s, res) => { try { resolve(s.read_line_finish_utf8(res)); } catch (e) { reject(e); } }));
    return {proc, name: line.trim(), pid: Number(proc.get_identifier())};
}

async function gone(proc) {
    proc.force_exit();
    await new Promise(r => proc.wait_async(null, () => r()));
}

// Start a process that takes pid (ns_last_pid; root in the container's pid namespace).
// The write and the fork share one shell so nothing else takes the pid
// between them; the shell prints the pid its child (the impostor) got.
async function impostor(pid) {
    const proc = Gio.Subprocess.new(['sh', '-c',
        `echo ${pid - 1} > /proc/sys/kernel/ns_last_pid || exit 3; sleep 60 & echo $!; wait`],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
    const stdout = new Gio.DataInputStream({base_stream: proc.get_stdout_pipe()});
    const [line] = await new Promise((resolve, reject) => stdout.read_line_async(GLib.PRIORITY_DEFAULT, null,
        (st, res) => { try { resolve(st.read_line_finish_utf8(res)); } catch (e) { reject(e); } }));
    return {proc, pid: Number(line ?? 0), why: line ? 'another process took it' : 'ns_last_pid not writable'};
}

async function check(tag, fn) {
    try {
        lines.push(`${tag}: ${await fn()}`);
    } catch (e) {
        lines.push(`${tag}: FAIL ${e.message}`);
    }
}

// The Shell's own open fds, after a moment to settle.
async function openFds() {
    await sleep(500);
    const dir = Gio.File.new_for_path('/proc/self/fd').enumerate_children('standard::name', 0, null);
    let count = 0;
    while (dir.next_file(null))
        count++;
    dir.close(null);
    return count;
}

// A caller whose parent never reaps it: killed, it stays a zombie.
async function unreapedCaller() {
    const proc = Gio.Subprocess.new(['sh', '-c', 'python3 -c "$0" & echo $!; exec sleep 60', HELPER],
        Gio.SubprocessFlags.STDOUT_PIPE);
    const stdout = new Gio.DataInputStream({base_stream: proc.get_stdout_pipe()});
    const read = () => new Promise((resolve, reject) => stdout.read_line_async(GLib.PRIORITY_DEFAULT, null,
        (st, res) => { try { resolve(st.read_line_finish_utf8(res)[0].trim()); } catch (e) { reject(e); } }));
    const pid = Number(await read());
    const name = await read();
    return {proc, pid, name};
}

async function main() {
    await check('live', async () => {
        const c = await caller();
        const id = await callerIdentity(c.name);
        await gone(c.proc);
        return id.pid === c.pid && id.pidfd && !id.sandboxed ? 'PASS' : `FAIL ${JSON.stringify(id)} pid ${c.pid}`;
    });
    await check('exited mid-check', async () => {
        const c = await caller();
        try {
            const id = await callerIdentity(c.name, {between: () => gone(c.proc)});
            return `FAIL identified ${JSON.stringify(id)}`;
        } catch (e) {
            return /process gone/.test(e.message) ? 'PASS' : `FAIL ${e.message}`;
        }
    });
    await check('pid reused mid-check', async () => {
        const c = await caller();
        let taken = null;
        try {
            const id = await callerIdentity(c.name, {between: async pid => {
                await gone(c.proc);
                taken = await impostor(pid);
            }});
            return `FAIL identified ${JSON.stringify(id)} (impostor ${taken?.pid})`;
        } catch (e) {
            const reused = taken?.pid === c.pid;
            taken?.proc?.force_exit();
            if (taken?.pid) GLib.spawn_command_line_sync(`kill ${taken.pid}`);
            if (!/process gone/.test(e.message))
                return `FAIL ${e.message}`;
            // Without a reused pid this only repeats "exited mid-check".
            return reused ? 'PASS, pid reused' : `SKIP, pid not reused (${taken?.why}; got ${taken?.pid})`;
        }
    });
    await check('no ProcessFD from the broker', async () => {
        const c = await caller();
        const id = await callerIdentity(c.name, {withoutProcessFd: true});
        await gone(c.proc);
        return id.pid === c.pid && !id.pidfd && !id.sandboxed ? 'PASS' : `FAIL ${JSON.stringify(id)}`;
    });
    // Details the caller hides: a stand-in /proc where they can't be read.
    const fake = GLib.dir_make_tmp('caller-proc-XXXXXX');
    const self = GLib.file_read_link('/proc/self/ns/mnt');
    const unreadable = async (tag, build, expect) => check(tag, async () => {
        const c = await caller();
        const dir = `${fake}/${c.pid}`;
        GLib.mkdir_with_parents(dir, 0o755);
        build(dir);
        try {
            const id = await callerIdentity(c.name, {proc: fake});
            return expect === 'identified' && id.appId === 'org.example.Probe' && !id.sandboxed ? 'PASS'
                : `FAIL identified ${JSON.stringify(id)}`;
        } catch (e) {
            return expect !== 'identified' && e.message === expect ? 'PASS' : `FAIL ${e.message}`;
        } finally {
            await gone(c.proc);
        }
    });
    const link = dir => {
        GLib.mkdir_with_parents(`${dir}/ns`, 0o755);
        Gio.File.new_for_path(`${dir}/ns/mnt`).make_symbolic_link(self, null);
    };
    await unreadable('stand-in /proc readable', dir => {
        link(dir);
        GLib.mkdir_with_parents(`${dir}/root`, 0o755);
        GLib.file_set_contents(`${dir}/cgroup`, '0::/user.slice/app.slice/app-gnome-org.example.Probe-42.scope\n');
    }, 'identified');
    await unreadable('mount namespace unreadable', () => {}, 'mount namespace unreadable');
    await unreadable('Flatpak info unreadable', dir => {
        link(dir);
        GLib.mkdir_with_parents(`${dir}/root/.flatpak-info`, 0o755);
    }, 'Flatpak info unreadable');
    await unreadable('cgroup unreadable', dir => {
        link(dir);
        GLib.mkdir_with_parents(`${dir}/root`, 0o755);
    }, 'cgroup unreadable');
    await check('unreadable and gone', async () => {
        const c = await caller();
        try {
            const id = await callerIdentity(c.name, {proc: fake, between: () => gone(c.proc)});
            return `FAIL identified ${JSON.stringify(id)}`;
        } catch (e) {
            return e.message === 'process gone' ? 'PASS' : `FAIL ${e.message}`;
        }
    });
    // Only the check after the reads can catch this one: every read succeeds.
    await check('gone after readable reads', async () => {
        const c = await caller();
        const dir = `${fake}/${c.pid}`;
        GLib.mkdir_with_parents(`${dir}/root`, 0o755);
        link(dir);
        GLib.file_set_contents(`${dir}/cgroup`, '0::/user.slice/app.slice/app-gnome-org.example.Probe-42.scope\n');
        try {
            const id = await callerIdentity(c.name, {proc: fake, between: () => gone(c.proc)});
            return `FAIL identified ${JSON.stringify(id)}`;
        } catch (e) {
            return e.message === 'process gone' ? 'PASS' : `FAIL ${e.message}`;
        }
    });
    await check('exited, not reaped', async () => {
        const c = await unreapedCaller();
        GLib.spawn_command_line_sync(`kill -9 ${c.pid}`);
        await sleep(300);
        try {
            const id = await callerIdentity(c.name);
            return `FAIL identified ${JSON.stringify(id)}`;
        } catch (e) {
            // The bus may already have dropped the name; either way it's refused as gone.
            return /process gone|not have an owner|NameHasNoOwner|no such name/i.test(e.message)
                ? 'PASS' : `FAIL ${e.message}`;
        } finally {
            c.proc.force_exit();
        }
    });
    // callerIdentity alone, many times over each path (identified, without
    // ProcessFD, refused as unreadable), with nothing else opened between counts.
    await check('no fds left open', async () => {
        const c = await caller();
        const dir = `${fake}/${c.pid}`;
        GLib.mkdir_with_parents(dir, 0o755);
        const before = await openFds();
        for (let i = 0; i < 20; i++) {
            await callerIdentity(c.name);
            await callerIdentity(c.name, {withoutProcessFd: true});
            await callerIdentity(c.name, {proc: fake}).catch(() => {});
        }
        const after = await openFds();
        await gone(c.proc);
        return after <= before ? `PASS (${before} before, ${after} after 60 calls)` : `FAIL (${before} before, ${after} after)`;
    });
    GLib.spawn_command_line_sync(`rm -rf ${fake}`);
    GLib.file_set_contents(out, `${lines.join('\n')}\n`);
    global.context.terminate();
}

export function init() { GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => { main(); return GLib.SOURCE_REMOVE; }); }
export async function run() { await new Promise(() => {}); }
