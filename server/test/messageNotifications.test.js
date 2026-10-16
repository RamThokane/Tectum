import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member } from './helpers.js';

before(start);
after(stop);

const msg = { ciphertext: 'QUJDREVGR0hJSktMTU5PUA==', iv: 'MTIzNDU2Nzg5MDEy', senderKeyId: 'key-sender-1', recipientKeyId: 'key-recipient-1' };
const messageNotes = async (who) => (await who.api('GET', '/notifications')).data.notifications.filter((n) => n.type === 'message');
const unread = async (who) => (await who.api('GET', '/notifications/unread-count')).data.unreadCount;

test('a message shows in the bell: one per sender, unread again on new messages, read when the chat is read', async () => {
  const me = await member();
  const friend = await member({ name: 'Friendly Sender' });
  const { data } = await friend.api('POST', '/chat/conversations', { userId: String(me.user._id) });
  const convId = data.conversation._id;

  assert.equal((await friend.api('POST', `/chat/conversations/${convId}/messages`, msg)).status, 201);
  await new Promise((r) => setTimeout(r, 300)); // the notification is best-effort, after the reply
  let notes = await messageNotes(me);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].sourceUser.name, 'Friendly Sender');
  assert.equal(String(notes[0].conversation), String(convId));
  assert.equal(notes[0].isRead, false);
  assert.equal(await unread(me), 1);

  // more messages: still one notification
  await friend.api('POST', `/chat/conversations/${convId}/messages`, msg);
  await friend.api('POST', `/chat/conversations/${convId}/messages`, msg);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await messageNotes(me)).length, 1);
  assert.equal(await unread(me), 1);

  // reading the chat reads the notification
  await me.api('POST', `/chat/conversations/${convId}/read`);
  assert.equal(await unread(me), 0);

  // a new message makes it unread again
  await friend.api('POST', `/chat/conversations/${convId}/messages`, msg);
  await new Promise((r) => setTimeout(r, 300));
  notes = await messageNotes(me);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].isRead, false);

  // the sender gets nothing for their own message
  assert.equal((await messageNotes(friend)).length, 0);
});

test('message notifications can be turned off in Settings', async () => {
  const me = await member();
  const friend = await member();
  assert.equal((await me.api('PUT', '/users/me/preferences', { notifications: { message: false } })).status, 200);
  const { data } = await friend.api('POST', '/chat/conversations', { userId: String(me.user._id) });
  await friend.api('POST', `/chat/conversations/${data.conversation._id}/messages`, msg);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await messageNotes(me)).length, 0);
});
