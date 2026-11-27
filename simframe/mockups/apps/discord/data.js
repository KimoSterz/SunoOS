/* Discord on Suno (mockup, 22 Oct 2026): the servers, channels, people and conversations the client shows.
   People with a key in the simulator's PPL (PR, NF, SK, TH, AR, JK, CL, me) keep their faces; the rest are drawn
   from their initials. Times are the simulator's day. */
(() => {
  const P = '../social-suno/photos/';
  let id = 1;
  const m = (from, t, x = {}) => ({ id: id++, from, t, at: x.at || '9:41 PM', ...x });

  const PEOPLE = {
    MZ: { n: 'Mika Zhao', u: 'mikaz', h: 40 },
    DV: { n: 'Dev Patel', u: 'devp', h: 210 },
    RB: { n: 'Rosa Bell', u: 'rosab', h: 15 },
    KO: { n: 'Kofi Owusu', u: 'kofi', h: 130 },
    OW: { n: 'Owlbot', u: 'owlbot', h: 265, bot: true },
    LB: { n: 'Suno', u: 'suno', h: 25, bot: true, img: 'assets/Suno-favicon.svg' },
    EM: { n: 'Emma Lindqvist', u: 'emma.l', h: 300 },
    WS: { n: 'Wes Ortega', u: 'wes', h: 75 },
  };
  /* presence: on, idle, dnd, off; act = what they're doing */
  const PRESENCE = {
    me: ['on'], TH: ['on', 'In voice · Lounge'], PR: ['on', 'In voice · Lounge'], NF: ['on', 'Streaming in Lounge'], SK: ['idle'], MZ: ['dnd', 'Editing the Venice clip'],
    DV: ['on', 'Listening to Pet Sounds'], RB: ['off'], KO: ['off'], OW: ['on'], LB: ['on'], AR: ['idle'], CL: ['on', 'At Mission Cliffs'], JK: ['off'], EM: ['on'], WS: ['off'],
  };

  const GUILDS = [
    { id: 'owls', n: 'Night Owls', h: 268, img: P + 'life-suite-bg-reel.webp', pos: '55% 40%', last: 'general', voice: { ch: 'lounge', people: ['TH', 'PR', 'NF'] },
      roles: [['Crew', 'TH', 'oklch(0.78 0.13 300)'], ['Members', null, null]], roleOf: { TH: 'Crew', MZ: 'Crew' },
      cats: [
        { n: 'Text channels', chs: [
          { id: 'general', n: 'general', topic: 'Late sessions, clips and whatever else',
            threads: [{ n: 'Saturday at the pier', count: 12, last: 'Theo: bring the wax', at: '8:10 PM' }, { n: 'Venice edit, notes', count: 5, last: 'Mika: v2 tonight', at: '7:20 PM' }, { n: 'Who has the speaker', count: 3, last: 'Sam: me!!', at: 'Yesterday' }], msgs: [
            m('TH', 'anyone skating tonight? the pier lights are back on', { day: 'Yesterday', at: '9:12 PM', pinned: true }),
            m('PR', 'after 10. still finishing a build for work', { at: '9:14 PM' }),
            m('SK', 'I’m in if someone brings the good wax', { at: '9:20 PM', reacts: { '😂': ['TH', 'PR', 'NF'] } }),
            m('NF', 'Mika finished the Venice edit', { day: 'Today', at: '7:02 PM' }),
            m('NF', null, { at: '7:02 PM', pinned: true, embed: { site: 'YouTube', title: 'Venice, after dark: Night Owls edit', text: 'Shot over three nights on the boardwalk. Music by Low Tide.', img: P + 'life-suite-bg-reel.webp' } }),
            m('TH', 'the last line is so clean', { at: '7:05 PM', reply: 'prev', reacts: { '🔥': ['PR', 'NF', 'SK', 'me'], '🦉': ['MZ'] } }),
            m('MZ', 'thank you!! took forever to sync the cuts', { at: '7:09 PM' }),
            m('SK', 'new setup is finally done', { at: '7:31 PM', img: P + 'life-work-suite.webp' }),
            m('PR', '@nick do you still have the cones from last time? need them for Saturday', { at: '8:03 PM', mention: true, isNew: true,
              thread: { n: 'Saturday at the pier', count: 12, last: 'Theo: bring the wax' } }),
            m('TH', 'also who has the speaker', { at: '8:04 PM' }),
          ] },
          { id: 'clips', n: 'clips', unread: 3, topic: 'Your best lines, raw or edited', msgs: [
            m('MZ', 'raw from tonight', { day: 'Today', at: '6:40 PM', img: P + 'life-suite-bg-reel.webp' }),
            m('SK', 'that kickflip!!', { at: '6:42 PM', reacts: { '🔥': ['TH', 'NF'] } }),
          ] },
          { id: 'spots', n: 'spots', topic: 'Where to skate, and when it’s empty', msgs: [ m('KO', 'Schoolyard on 5th is open Sundays now', { day: 'Monday', at: '2:10 PM' }) ] },
          { id: 'meetups', n: 'meetups', mentions: 1, unread: 2, msgs: [ m('TH', '@nick Saturday 9 PM at the pier. You in?', { day: 'Today', at: '5:12 PM', mention: true }), m('OW', 'Event created: Saturday at the pier · 9:00 PM · 6 going', { at: '5:12 PM', sys: true }) ] },
        ] },
        { n: 'Voice', chs: [ { id: 'lounge', n: 'Lounge', voice: true }, { id: 'session', n: 'Session', voice: true } ] },
      ],
      members: ['TH', 'MZ', 'PR', 'NF', 'SK', 'DV', 'OW', 'me', 'KO', 'RB', 'WS'] },

    { id: 'synth', n: 'Synth Lab', h: 195, img: P + 'life-suite-bg-sessions.webp', pos: '50% 45%', last: 'patches',
      roles: [['Moderators', 'DV', 'oklch(0.8 0.12 195)'], ['Members', null, null]], roleOf: { DV: 'Moderators' },
      cats: [
        { n: 'Text channels', chs: [
          { id: 'synth-general', n: 'general', msgs: [ m('EM', 'Anyone tried the new filter firmware?', { day: 'Today', at: '4:20 PM' }) ] },
          { id: 'patches', n: 'patches', topic: 'Share presets. Say what synth they’re for.', msgs: [
            m('DV', 'Warm pad for the Minilogue, starting point for anything slow', { day: 'Today', at: '6:12 PM' }),
            m('DV', null, { at: '6:12 PM', pinned: true, code: 'osc1   saw    oct 8\'   pitch -0.07\nosc2   saw    oct 8\'   pitch +0.07\nfilter cutoff 38   reso 22   eg int +14\namp eg A 62  D 40  S 80  R 70\ndelay  hi-pass 30  time 58  feedback 44' }),
            m('EM', 'this is lovely. swapped the delay for chorus and it’s even softer', { at: '6:30 PM', reacts: { '🎛️': ['DV', 'me'] } }),
            m('me', 'Recorded a loop with it', { at: '6:41 PM', file: { n: 'warm-pad-loop.flac', size: '4.2 MB' } }),
          ] },
          { id: 'feedback', n: 'feedback', unread: 1, msgs: [ m('WS', 'Mix feedback please, the low end feels muddy', { day: 'Today', at: '3:02 PM' }) ] },
          { id: 'gear', n: 'gear', msgs: [ m('DV', 'Selling my old Volca Keys, DM me', { day: 'Sunday', at: '1:15 PM' }) ] },
        ] },
        { n: 'Voice', chs: [ { id: 'studio', n: 'Studio', voice: true } ] },
      ],
      members: ['DV', 'EM', 'me', 'WS', 'AR'] },

    { id: 'suno', n: 'Suno', h: 28, icon: 'assets/Suno-favicon.svg', last: 'announcements', mentions: 0, unreadDot: true,
      roles: [['Suno team', 'LB', 'oklch(0.78 0.14 45)'], ['Members', null, null]], roleOf: { LB: 'Suno team', NF: 'Suno team' },
      cats: [
        { n: 'Start here', chs: [
          { id: 'announcements', n: 'announcements', kind: 'news', unread: 1, topic: 'News from the Suno team', msgs: [
            m('LB', 'Nightly 20261021.1 is out. Mail sorts newsletters on its own now, Depot has a new design, and phones get the pocket layout.', { day: 'Today', at: '1:45 AM', reacts: { '🎉': ['NF', 'DV', 'EM', 'KO', 'me'], '❤️': ['PR', 'SK'] } }),
          ] },
          { id: 'welcome', n: 'welcome', msgs: [ m('LB', 'Welcome to the Suno community. Say hello in #general and tell us what you run Suno on.', { day: 'Oct 7', at: '9:00 AM' }) ] },
        ] },
        { n: 'Community', chs: [
          { id: 'help', n: 'help', msgs: [ m('KO', 'Fairphone 6: modem works after the second boot, is that expected?', { day: 'Today', at: '11:20 AM' }), m('NF', 'Yes, the first start has to be a fastboot boot. The guide has the steps.', { at: '11:31 AM', reply: 'prev' }) ] },
          { id: 'show', n: 'show-and-tell', msgs: [ m('EM', 'My desk running the nightly', { day: 'Yesterday', at: '8:15 PM', img: P + 'life-hero-writing.webp', reacts: { '😍': ['NF', 'me'] } }) ] },
        ] },
        { n: 'Voice', chs: [ { id: 'office', n: 'Office hours', voice: true } ] },
      ],
      members: ['LB', 'NF', 'me', 'KO', 'EM', 'DV', 'PR'] },

    { id: 'climb', n: 'Oakland Climbers', h: 150, img: P + 'life-footer.webp', pos: '50% 50%', last: 'climb-general',
      roles: [['Members', null, null]], roleOf: {},
      cats: [ { n: 'Text channels', chs: [
        { id: 'climb-general', n: 'general', msgs: [ m('CL', 'Mission Cliffs Thursday 7pm, who’s in?', { day: 'Today', at: '12:40 PM' }) ] },
        { id: 'carpools', n: 'carpools', msgs: [ m('AR', 'Driving to Castle Rock Sunday, 2 seats', { day: 'Yesterday', at: '6:00 PM' }) ] },
      ] }, { n: 'Voice', chs: [ { id: 'belay', n: 'Belay chat', voice: true } ] } ],
      members: ['CL', 'AR', 'me', 'TH'] },

    { id: 'pixel', n: 'Pixel Pushers', h: 330, img: P + 'life-suite-bg-canvas.webp', pos: '50% 50%', last: 'critique', mentions: 2,
      roles: [['Members', null, null]], roleOf: {},
      cats: [ { n: 'Text channels', chs: [
        { id: 'critique', n: 'critique', mentions: 2, unread: 4, msgs: [ m('RB', '@nick poster v3 is up, honest thoughts?', { day: 'Today', at: '3:30 PM', mention: true, img: P + 'life-suite-bg-canvas.webp' }), m('EM', '@nick the type on the left is fighting the photo', { at: '3:44 PM', mention: true }) ] },
        { id: 'inspo', n: 'inspo', msgs: [ m('RB', 'Saving these for later', { day: 'Monday', at: '9:00 AM' }) ] },
      ] } ],
      members: ['RB', 'EM', 'me', 'MZ'] },
  ];

  /* Direct messages: the Home list */
  const DMS = [
    { id: 'dm-pr', with: 'PR', unread: 1, msgs: [ m('PR', 'are you coming tonight or should I save you a spot in voice', { day: 'Today', at: '8:20 PM' }) ] },
    { id: 'dm-roof', name: 'Rooftop crew', group: ['TH', 'NF', 'SK'], msgs: [ m('SK', 'pizza on the roof friday?', { day: 'Today', at: '6:00 PM' }), m('TH', 'yes', { at: '6:01 PM' }) ] },
    { id: 'dm-th', with: 'TH', msgs: [ m('me', 'sending you the cones photo', { day: 'Yesterday', at: '10:02 PM' }) ] },
    { id: 'dm-dv', with: 'DV', msgs: [ m('DV', 'the patch worked on the Prologue too', { day: 'Monday', at: '7:30 PM' }) ] },
    { id: 'dm-cl', with: 'CL', msgs: [ m('CL', 'Thursday?', { day: 'Sunday', at: '5:12 PM' }) ] },
  ];

  /* what people say back when you write in Night Owls #general (the mockup's one live conversation) */
  const REPLIES = [['TH', 'haha yes'], ['PR', 'see you there'], ['SK', 'bringing the speaker'], ['NF', 'perfect']];
  const EMOJI = ['😂', '🔥', '❤️', '👍', '🙏', '🦉', '🎉', '😍', '👀', '💯', '🛹', '🎛️'];

  window.DISCORD_DATA = { PEOPLE, PRESENCE, GUILDS, DMS, REPLIES, EMOJI, nextId: () => id++ };
})();
