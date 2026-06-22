import type { User as PrismaUser } from '@prisma/client';
import { UserPublic, UserRole } from '@api-gateway-ms/shared';

const toUserRole = (role: PrismaUser['role']): UserRole => {
  switch (role) {
    case 'ADMIN':
      return UserRole.ADMIN;
    case 'MODERATOR':
      return UserRole.MODERATOR;
    case 'USER':
      return UserRole.USER;
  }
};

export const toPublicUser = (user: PrismaUser): UserPublic => ({
  id: user.id,
  email: user.email,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  role: toUserRole(user.role),
});
