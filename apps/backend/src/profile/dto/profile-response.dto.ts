/** Profil de l'utilisateur connecté (`GET /profile`, N15), en lecture seule. */
export class ProfileResponseDto {
  account: {
    id: string;
    username: string;
    email: string;
    authProvider: 'LOCAL' | 'ACTIVE_DIRECTORY';
    roles: string[];
    lastLoginAt: string | null;
    createdAt: string;
  };
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    professionalEmail: string;
    phone: string | null;
    department: { id: string; name: string };
    position: string;
    manager: { id: string; firstName: string; lastName: string } | null;
    hireDate: string;
  } | null;
}
