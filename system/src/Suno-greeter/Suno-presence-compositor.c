// SPDX-License-Identifier: Apache-2.0

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>

#define PHOC "/usr/bin/phoc"

int main(void) {
  if (umask(0007) == (mode_t)-1) {
    perror("Suno-presence-compositor: umask");
    return 1;
  }
  if (setenv("XDG_RUNTIME_DIR", "/run/Suno-display", 1) != 0) {
    perror("Suno-presence-compositor: setenv");
    return 1;
  }

  execl(PHOC, "phoc", "--persistent", "--handoff-app-id",
        "org.projectSuno.Greeter", "--socket", "wayland-0", "-S", "-C",
        "/usr/share/phosh/phoc.ini", "-E", "/usr/libexec/Suno-greeter-session",
        (char *)NULL);
  perror("Suno-presence-compositor: exec phoc");
  return 127;
}
