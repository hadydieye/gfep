import { EmploymentStatus } from '@prisma/client';

export class EmployeeResponseDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  professionalEmail: string;
  phone: string | null;
  departmentId: string;
  department: { id: string; name: string; code: string };
  positionId: string;
  position: { id: string; title: string };
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export class PaginatedEmployeesDto {
  data: EmployeeResponseDto[];
  total: number;
  page: number;
  limit: number;
}
