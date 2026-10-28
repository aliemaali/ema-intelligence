import test from 'node:test'
import assert from 'node:assert/strict'
import { mailFingerprint, parseMailDismissal } from './mail-dismissals'
import { horizontalSwipe, mailSelectionKey, toggleMailSelection } from './mail-selection'
const first={mailbox:'info@ema-enterprise.de',id:'message-1'},second={mailbox:'unluer@ema-enterprise.de',id:'message-1'}
test('the same provider id in different mailboxes remains independent',()=>{assert.notEqual(mailSelectionKey(first),mailSelectionKey(second));assert.notEqual(mailFingerprint(first),mailFingerprint(second))})
test('fingerprints do not persist the raw message identity',()=>{assert.match(mailFingerprint(first),/^[0-9a-f]{64}$/);assert.equal(mailFingerprint(first),mailFingerprint({...first}))})
test('bulk hide deduplicates references but preserves both mailboxes',()=>{assert.deepEqual(parseMailDismissal({action:'hide',messages:[first,first,second]}),{action:'hide',messages:[first,second]})})
test('undo accepts the exact same bounded reference list',()=>{assert.deepEqual(parseMailDismissal({action:'restore',messages:[first]}),{action:'restore',messages:[first]})})
test('rejects foreign mailboxes, malformed ids, empty and oversized requests',()=>{for(const body of [null,{action:'delete',messages:[first]},{action:'hide',messages:[]},{action:'hide',messages:Array(101).fill(first)},{action:'hide',messages:[{...first,mailbox:'other@example.com'}]},{action:'hide',messages:[{...first,id:'\n'}]},{action:'hide',messages:[{...first,id:'x'.repeat(2049)}]}])assert.throws(()=>parseMailDismissal(body))})
test('selection toggles never mutate the previous selection',()=>{const before=new Set([mailSelectionKey(first)]);const after=toggleMailSelection(before,mailSelectionKey(second));assert.equal(before.size,1);assert.equal(after.size,2);assert.equal(toggleMailSelection(after,mailSelectionKey(first)).size,1)})
test('a tap and vertical/diagonal page scrolling do not activate a swipe',()=>{assert.equal(horizontalSwipe(-5,0),false);assert.equal(horizontalSwipe(-15,50),false);assert.equal(horizontalSwipe(-30,30),false)})
test('deliberate horizontal motion activates left reveal and right close',()=>{assert.equal(horizontalSwipe(-55,8),true);assert.equal(horizontalSwipe(55,8),true)})
