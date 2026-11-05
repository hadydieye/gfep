import { EmploymentStatus } from '@prisma/client';

export class DepartmentResponseDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  headcount: number; // calculé dynamiquement, non stocké
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
  } | null;
  // Postes du département, utilisés par les sélecteurs du formulaire employé
  positions: Array<{ id: string; title: string }>;
  createdAt: string;
}

export class DepartmentDetailResponseDto extends DepartmentResponseDto {
  employees: Array<{
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    position: string;
    employmentStatus: EmploymentStatus;
  }>;
}
