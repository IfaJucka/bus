import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../services/authService';
import { NotificationService } from '../services/notificationService';
import { db } from '../database';

test('Fix Verification: Admin Login Authentication', async () => {
  await db.initDatabase();

  const validAdmin = await AuthService.authenticate('admin', 'admin123', 'admin');
  assert.ok(validAdmin && 'user' in validAdmin, 'Admin login must succeed with admin123');
  assert.equal(validAdmin.user.role, 'admin');
  assert.ok(validAdmin.token, 'Token must be issued');

  // Verify role restriction: admin trying to login via student portal
  const restrictedPortal = await AuthService.authenticate('admin', 'admin123', 'student');
  assert.ok(restrictedPortal && 'error' in restrictedPortal, 'Portal restriction must reject role mismatch');
});

test('Fix Verification: Driver Login Authentication', async () => {
  const validDriver = await AuthService.authenticate('driver1', 'driver123', 'driver');
  assert.ok(validDriver && 'user' in validDriver, 'Driver login must succeed with driver123');
  assert.equal(validDriver.user.role, 'driver');
  assert.ok(validDriver.user.driverId, 'Driver ID must be assigned');
});

test('Fix Verification: Student Login Authentication (by username or student_id)', async () => {
  // Test by username
  const validStudent = await AuthService.authenticate('student1', 'student123', 'student');
  assert.ok(validStudent && 'user' in validStudent, 'Student login must succeed with student123');
  assert.equal(validStudent.user.role, 'student');

  // Test by student_id
  const byStudentId = await AuthService.authenticate('4AI21CS045', 'student123', 'student');
  assert.ok(byStudentId && 'user' in byStudentId, 'Student login must succeed using student_id (4AI21CS045)');
  assert.equal(byStudentId.user.role, 'student');

  // Test invalid password
  const invalidPass = await AuthService.authenticate('student1', 'wrongpassword');
  assert.equal(invalidPass, null, 'Must reject incorrect password');
});

test('Fix Verification: Notification Read State & Mark All Read', async () => {
  // Create a test unread notification
  const notif = await NotificationService.createNotification({
    title: 'Test Notification Badge',
    message: 'Testing unread badge disappearance',
    category: 'announcement',
    studentIdentifier: 'student1',
  });

  assert.ok(notif.id > 0, 'Notification should be created');

  // Mark specific read
  const marked = await NotificationService.markAsRead(notif.id);
  assert.equal(marked, true, 'Notification should be marked read');

  // Mark all read
  const allMarked = await NotificationService.markAllAsRead('student1');
  assert.equal(allMarked, true, 'All notifications should be marked read');
});
