import { describe, expect, it } from 'vitest';
import { permissionsFor } from './policy.js';
describe('admin role bundles', () => {
  it('does not grant owner operations to support', () =>
    expect(permissionsFor('SUPPORT').has('admin.roles.manage')).toBe(false));
  it('does not grant super-admin enforcement to moderators', () =>
    expect(permissionsFor('MODERATOR').has('moderation.ban')).toBe(false));
  it('keeps platform permissions separate from club roles', () =>
    expect(permissionsFor('MODERATOR').has('club.moderator' as never)).toBe(
      false,
    ));
});
