import fs from 'fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(fs.readFileSync('/home/claude/creator_builder.html', 'utf8'),
  { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const D = window.document, cb = window.__cb;
const $ = id => D.getElementById(id);
const vis = el => el && el.style.display !== 'none';
const onPanes = () => [].map.call(D.querySelectorAll('.pane.on'), p => p.id);
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

/* ── 1 · the creator LANDS on the hub, not mid-build ────────────────────── */
ok('app opens on the hub', onPanes().join() === 'p0', `visible: ${onPanes().join() || 'none'}`);
ok('exactly one pane visible', onPanes().length === 1);
ok('step progress hidden on the hub', !vis($('bar')) && !vis($('steps')));
ok('builder footer hidden on the hub', !vis($('ft')));
ok('save & exit hidden on the hub', !vis($('exit')));
ok('header reads Creator', $('hdTitle').textContent === 'Creator', $('hdTitle').textContent);
ok('the hub declares the mode: Cash', $('cashtag').textContent.trim() === 'Cash');

/* ── 2 · all four choices Frank named exist, plus the way in ────────────── */
const tiles = [].map.call(D.querySelectorAll('#p0 .tile .n b'), b => b.textContent);
ok('four tiles on the hub', tiles.length === 4, tiles.join(' | '));
ok('tile: read the rules', /Read the rules/.test(tiles[0]));
ok('tile: how to become a creator', /How to become a creator/.test(tiles[1]));
ok('tile: talk to Lockpick', /Talk to Lockpick/.test(tiles[2]));
ok('tile: practice mode', /Practice mode/.test(tiles[3]));
ok('primary action is Build a slate', $('goBuild').textContent.trim() === 'Build a slate');

/* ── 3 · every choice opens its own view and every view returns home ────── */
for (const [btn, pane, label] of [['goRules', 'pRules', 'rules'], ['goHow', 'pHow', 'how'],
                                  ['goPick', 'pPick', 'lockpick'], ['goPrac', 'pPrac', 'practice']]) {
  click($(btn));
  const one = onPanes().length === 1 && onPanes()[0] === pane;
  ok(`${label}: opens ${pane}`, one && cb.view === label, `visible: ${onPanes().join()}`);
  ok(`${label}: chrome stays hidden`, !vis($('bar')) && !vis($('ft')));
  click(D.querySelector(`#${pane} .crumb .home`));
  ok(`${label}: back returns to the hub`, onPanes().join() === 'p0' && cb.view === 'hub');
}

/* ── 4 · the rules screen carries the compliance canon, not vibes ───────── */
click($('goRules'));
const rules = $('pRules').textContent;
for (const t of ['Cross-game head-to-head', 'Field leader', 'Split-squad duos',
                 'Milestone count', 'First to N', 'Biggest night'])
  ok(`rules list the ${t} archetype`, rules.includes(t));
ok('rules ban game outcomes/spreads/totals',
   /Who wins a game/.test(rules) && /spreads/.test(rules) && /over\/under/.test(rules));
ok('rules state two names = two different games', /two different games/.test(rules));
ok('rules state one pot per slate', /One pot per slate/.test(rules));
ok('rules state payouts fix at close', /become fixed the moment it closes/.test(rules));
ok('rules do NOT render rake', !/rake/i.test(rules));
click(D.querySelector('#pRules .crumb .home'));

/* ── 5 · Lockpick answers by NAMING THE FIX ─────────────────────────────── */
click($('goPick'));
ok('FAB hidden while inside Lockpick', !vis($('ls')));
const before = D.querySelectorAll('#thread .msg').length;
click(D.querySelector('#askChips .chip[data-a="same"]'));
const after = D.querySelectorAll('#thread .msg').length;
ok('asking adds the question and a reply', after === before + 2, `${before} → ${after}`);
await new Promise(r => setTimeout(r, 600));
const reply = D.querySelectorAll('#thread .msg.them');
ok('the reply names the fix, not just the error',
   /Giannis/.test(reply[reply.length - 1].textContent),
   reply[reply.length - 1].textContent.slice(0, 60) + '…');
click(D.querySelector('#pPick .crumb .home'));
ok('FAB back after leaving Lockpick', vis($('ls')));

/* ── 6 · Build a slate drops into the existing flow, unchanged ──────────── */
click($('goBuild'));
ok('builder opens on step 1', onPanes().join() === 'p1' && cb.step === 1);
ok('progress + footer return', vis($('bar')) && vis($('steps')) && vis($('ft')));
ok('header reads Build a slate', $('hdTitle').textContent === 'Build a slate');
ok('next button label unchanged', $('next').textContent === 'Next: pick the night');

click($('next')); ok('step 2', cb.step === 2 && onPanes().join() === 'p2');
click($('next')); ok('step 3', cb.step === 3 && onPanes().join() === 'p3');
ok('invalid leg still blocks the step', $('next').disabled === true, $('next').textContent);
cb.fixLeg2();
ok('naming the fix unblocks it', $('next').disabled === false, $('next').textContent);
click($('next')); ok('step 4', cb.step === 4);
click($('next')); ok('review', cb.step === 5 && onPanes().join() === 'p5');
ok('review still shows the player-facing card', !!D.querySelector('#p5 .preview .cta'));

/* ── 7 · save & exit lands back on the hub ──────────────────────────────── */
click($('exit'));
ok('save & exit returns to the hub', onPanes().join() === 'p0' && cb.view === 'hub');

/* ── 8 · practice is a SEPARATE surface — it never opens this builder ───── */
click($('goPrac'));
ok('practice screen says it is its own build', /its own build/.test($('pPrac').textContent));
ok('practice screen says coins', /coin/i.test($('pPrac').textContent));
click($('startPrac'));
ok('practice does NOT enter the cash builder',
   cb.view === 'practice' && onPanes().join() === 'pPrac');
ok('it says where practice actually lives', vis($('pracNote')));
ok('no practice labelling exists on the builder', !D.getElementById('pracBanner'));
click(D.querySelector('#pPrac .home2'));
ok('back to cash creator mode enters the builder',
   cb.view === 'builder' && cb.step === 1 && $('hdTitle').textContent === 'Build a slate');
click($('exit'));

/* ── 9 · the step-1 practice button routes to the same place ────────────── */
click($('goBuild'));
click($('prac'));
ok('step 1 practice link opens practice mode', cb.view === 'practice' && onPanes().join() === 'pPrac');

/* ── 10 · invariant: never two panes, never a stranded footer ───────────── */
let bad = 0;
for (const v of ['hub', 'rules', 'how', 'lockpick', 'practice']) {
  cb.view = v;
  if (onPanes().length !== 1 || vis($('ft')) || vis($('bar'))) bad++;
}
cb.step = 2;
if (onPanes().length !== 1 || !vis($('ft'))) bad++;
ok('one pane and correct chrome in every view', bad === 0, `violations ${bad}`);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
