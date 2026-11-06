import type { Prisma } from '@prisma/client';
import type { SortMap } from '../common/sorting.js';

type OrderBy = Prisma.EmployeeOrderByWithRelationInput;

/** Colonnes triables de `GET /employees` (N6, design §3.2). */
export const EMPLOYEE_SORTS: SortMap<OrderBy> = {
  lastName: (order) => [{ lastName: order }, { firstName: order }],
  employeeNumber: (order) => [{ employeeNumber: order }],
  department: (order) => [{ department: { name: order } }],
  position: (order) => [{ position: { title: order } }],
  hireDate: (order) => [{ hireDate: order }],
  status: (order) => [{ employmentStatus: order }],
};
export const EMPLOYEE_SORT_TIEBREAKER: OrderBy[] = [{ id: 'asc' }];
export const EMPLOYEE_DEFAULT_ORDER: OrderBy[] = [{ lastName: 'asc' }, { firstName: 'asc' }];
