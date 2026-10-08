import assert from 'node:assert/strict';
import test from 'node:test';
import { expiryReminderKind, expiryReminderMessage, isWithinSendWindow } from './pushReminders.js';

const now = new Date('2026-10-08T12:00:00.000Z');
const hours = (value: number) => new Date(now.getTime() + value * 3_600_000);

test('expiryReminderKind picks the stage by time left', () => {
  assert.equal(expiryReminderKind(hours(80), now), null);
  assert.equal(expiryReminderKind(hours(72), now), 'expiry_before');
  assert.equal(expiryReminderKind(hours(1), now), 'expiry_before');
  assert.equal(expiryReminderKind(hours(0), now), 'expiry_today');
  assert.equal(expiryReminderKind(hours(-23), now), 'expiry_today');
  assert.equal(expiryReminderKind(hours(-48), now), null);
  assert.equal(expiryReminderKind(hours(-72), now), 'expiry_after');
  assert.equal(expiryReminderKind(hours(-167), now), 'expiry_after');
  assert.equal(expiryReminderKind(hours(-168), now), null);
});

test('isWithinSendWindow uses Moscow time', () => {
  assert.equal(isWithinSendWindow(new Date('2026-10-08T06:59:00.000Z')), false);
  assert.equal(isWithinSendWindow(new Date('2026-10-08T07:00:00.000Z')), true);
  assert.equal(isWithinSendWindow(new Date('2026-10-08T17:59:00.000Z')), true);
  assert.equal(isWithinSendWindow(new Date('2026-10-08T18:00:00.000Z')), false);
});

test('expiryReminderMessage keeps the old price for past payers', () => {
  const activeTo = new Date('2026-10-11T09:00:00.000Z');
  const returning = expiryReminderMessage('expiry_before', { activeTo, isTrial: false, isReturning: true });
  assert.equal(returning.title, 'Доступ к socstat заканчивается 11 октября');
  assert.match(returning.body, /Ваша цена сохранена: 499 ₽/);

  const trial = expiryReminderMessage('expiry_today', { activeTo, isTrial: true, isReturning: false });
  assert.equal(trial.title, 'Пробный доступ закончился');
  assert.match(trial.body, /Месяц — 699 ₽/);
});
