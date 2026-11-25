/* Huddle's data (25 Oct 2026). Stands in for a live scores API: teams, standings, the week's games, last week's results.
   Kickoffs are stored relative to the moment the page opens, so the slate always reads as a Sunday afternoon in
   progress and every time is shown in the viewer's own timezone. Team marks are each club's colours and short
   name; the real logos come from the licensed data provider. */
(() => {
  const T = (id, city, name, conf, div, c1, c2, w, l, t = 0, strk = 'W1') => ({ id, city, name, conf, div, c1, c2, w, l, t, strk });
  const teams = [
    T('BUF', 'Buffalo', 'Bills', 'AFC', 'East', '#00338D', '#C60C30', 5, 2, 0, 'W2'), T('MIA', 'Miami', 'Dolphins', 'AFC', 'East', '#008E97', '#FC4C02', 4, 3, 0, 'L1'),
    T('NE', 'New England', 'Patriots', 'AFC', 'East', '#002244', '#C60C30', 3, 4, 0, 'W1'), T('NYJ', 'New York', 'Jets', 'AFC', 'East', '#125740', '#FFFFFF', 2, 5, 0, 'L3'),
    T('BAL', 'Baltimore', 'Ravens', 'AFC', 'North', '#241773', '#9E7C0C', 5, 2, 0, 'W3'), T('PIT', 'Pittsburgh', 'Steelers', 'AFC', 'North', '#101820', '#FFB612', 4, 3, 0, 'L1'),
    T('CIN', 'Cincinnati', 'Bengals', 'AFC', 'North', '#FB4F14', '#000000', 3, 4, 0, 'W1'), T('CLE', 'Cleveland', 'Browns', 'AFC', 'North', '#311D00', '#FF3C00', 2, 5, 0, 'L2'),
    T('HOU', 'Houston', 'Texans', 'AFC', 'South', '#03202F', '#A71930', 4, 3, 0, 'W1'), T('IND', 'Indianapolis', 'Colts', 'AFC', 'South', '#002C5F', '#A2AAAD', 4, 3, 0, 'W2'),
    T('JAX', 'Jacksonville', 'Jaguars', 'AFC', 'South', '#006778', '#D7A22A', 4, 4, 0, 'W1'), T('TEN', 'Tennessee', 'Titans', 'AFC', 'South', '#0C2340', '#4B92DB', 1, 7, 0, 'L4'),
    T('KC', 'Kansas City', 'Chiefs', 'AFC', 'West', '#E31837', '#FFB81C', 6, 1, 0, 'W5'), T('LAC', 'Los Angeles', 'Chargers', 'AFC', 'West', '#0080C6', '#FFC20E', 4, 3, 0, 'W1'),
    T('DEN', 'Denver', 'Broncos', 'AFC', 'West', '#FB4F14', '#002244', 4, 3, 0, 'L1'), T('LV', 'Las Vegas', 'Raiders', 'AFC', 'West', '#000000', '#A5ACAF', 2, 5, 0, 'L2'),
    T('PHI', 'Philadelphia', 'Eagles', 'NFC', 'East', '#004C54', '#A5ACAF', 6, 1, 0, 'W4'), T('WAS', 'Washington', 'Commanders', 'NFC', 'East', '#5A1414', '#FFB612', 4, 4, 0, 'L1'),
    T('DAL', 'Dallas', 'Cowboys', 'NFC', 'East', '#041E42', '#869397', 3, 4, 0, 'W1'), T('NYG', 'New York', 'Giants', 'NFC', 'East', '#0B2265', '#A71930', 2, 5, 0, 'L2'),
    T('DET', 'Detroit', 'Lions', 'NFC', 'North', '#0076B6', '#B0B7BC', 6, 1, 0, 'W4'), T('GB', 'Green Bay', 'Packers', 'NFC', 'North', '#203731', '#FFB612', 5, 2, 0, 'W2'),
    T('MIN', 'Minnesota', 'Vikings', 'NFC', 'North', '#4F2683', '#FFC62F', 5, 2, 0, 'L1'), T('CHI', 'Chicago', 'Bears', 'NFC', 'North', '#0B162A', '#C83803', 3, 4, 0, 'W1'),
    T('ATL', 'Atlanta', 'Falcons', 'NFC', 'South', '#A71930', '#000000', 4, 3, 0, 'W1'), T('TB', 'Tampa Bay', 'Buccaneers', 'NFC', 'South', '#D50A0A', '#34302B', 4, 3, 0, 'L1'),
    T('NO', 'New Orleans', 'Saints', 'NFC', 'South', '#101820', '#D3BC8D', 3, 4, 0, 'L2'), T('CAR', 'Carolina', 'Panthers', 'NFC', 'South', '#0085CA', '#101820', 2, 6, 0, 'W1'),
    T('SF', 'San Francisco', '49ers', 'NFC', 'West', '#AA0000', '#B3995D', 5, 2, 0, 'W2'), T('SEA', 'Seattle', 'Seahawks', 'NFC', 'West', '#002244', '#69BE28', 4, 3, 0, 'L1'),
    T('LAR', 'Los Angeles', 'Rams', 'NFC', 'West', '#003594', '#FFA300', 4, 3, 0, 'W1'), T('ARI', 'Arizona', 'Cardinals', 'NFC', 'West', '#97233F', '#000000', 3, 4, 0, 'L1'),
  ];
  /* kickoff, in minutes from now (negative: already started), rounded to five minutes so times read like a schedule */
  const now = Date.now(), at = m => { const t = new Date(now + m * 60e3); t.setMinutes(Math.round(t.getMinutes() / 5) * 5, 0, 0); return t.getTime(); };
  const day = (d, h, m) => { const t = new Date(now); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.getTime(); };
  /* st: live · half · delay · final · pre · post (postponed). q is the quarter (5 = overtime), clk seconds left. */
  const G = (id, away, home, ko, st, o = {}) => ({ id, away, home, ko, st, as: 0, hs: 0, q: 0, clk: 900, pos: '', dd: '', tv: '', ...o });
  const games = [
    G('w8-buf-mia', 'BUF', 'MIA', at(-115), 'live', { as: 24, hs: 20, q: 4, clk: 372, pos: 'BUF', dd: '1st & 10 · MIA 38', tv: 'CBS' }),
    G('w8-det-gb', 'DET', 'GB', at(-115), 'live', { as: 17, hs: 14, q: 3, clk: 522, pos: 'GB', dd: '3rd & 4 · GB 41', tv: 'FOX' }),
    G('w8-phi-nyg', 'PHI', 'NYG', at(-115), 'half', { as: 10, hs: 3, q: 2, clk: 0, tv: 'FOX' }),
    G('w8-cin-bal', 'CIN', 'BAL', at(-115), 'live', { as: 13, hs: 21, q: 3, clk: 129, pos: 'CIN', dd: '2nd & 8 · BAL 22', tv: 'CBS' }),
    G('w8-tb-atl', 'TB', 'ATL', at(-115), 'live', { as: 27, hs: 27, q: 4, clk: 690, pos: 'ATL', dd: '1st & 10 · ATL 25', tv: 'FOX' }),
    G('w8-hou-ind', 'HOU', 'IND', at(-115), 'delay', { as: 7, hs: 7, q: 2, clk: 412, note: 'Weather delay · lightning in the area', tv: 'CBS' }),
    G('w8-cle-pit', 'CLE', 'PIT', at(-115), 'live', { as: 13, hs: 16, q: 4, clk: 48, pos: 'CLE', dd: '4th & 2 · PIT 30', tv: 'CBS' }),
    G('w8-jax-ten', 'JAX', 'TEN', at(-330), 'final', { as: 23, hs: 20, q: 5, note: 'London', tv: 'NFL Network' }),
    G('w8-kc-lv', 'KC', 'LV', at(95), 'pre', { tv: 'CBS' }),
    G('w8-sf-sea', 'SF', 'SEA', at(115), 'pre', { tv: 'FOX' }),
    G('w8-dal-lar', 'DAL', 'LAR', at(115), 'pre', { tv: 'FOX' }),
    G('w8-no-ari', 'NO', 'ARI', at(115), 'post', { note: 'Postponed · moved to Monday', moved: day(1, 16, 0) }),
    G('w8-lac-den', 'LAC', 'DEN', at(380), 'pre', { tv: 'NBC', slot: 'Sunday Night Football' }),
    G('w8-nyj-ne', 'NYJ', 'NE', day(1, 20, 15), 'pre', { tv: 'ESPN', slot: 'Monday Night Football' }),
    G('w8-was-car', 'WAS', 'CAR', day(-3, 20, 15), 'final', { as: 20, hs: 31, q: 4, tv: 'Prime Video', slot: 'Thursday Night Football' }),
  ];
  /* last week, for Results and team pages */
  const last = [
    ['KC', 'DEN', 27, 17], ['DET', 'MIN', 31, 24], ['BUF', 'NE', 20, 23], ['PHI', 'DAL', 34, 10], ['GB', 'CHI', 24, 20], ['BAL', 'PIT', 28, 14],
    ['SF', 'LAR', 17, 20], ['MIA', 'NYJ', 30, 13], ['ATL', 'NO', 26, 21], ['SEA', 'ARI', 16, 13], ['IND', 'TEN', 31, 17], ['LAC', 'LV', 23, 9],
    ['HOU', 'JAX', 19, 22], ['CIN', 'CLE', 24, 10], ['TB', 'CAR', 30, 27], ['NYG', 'WAS', 14, 27],
  ].map(([away, home, as, hs], i) => G('w7-' + i, away, home, day(-7, 13, 0) + (i % 3) * 3.4 * 36e5, 'final', { as, hs, q: 4 }));
  window.HUDDLE_DATA = { teams, games, last, week: 8 };
})();
