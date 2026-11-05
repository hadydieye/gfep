export class DashboardResponseDto {
  role: string;
  indicators: {
    totalEmployees?: number;
    departmentEmployees?: number;
    departmentName?: string;
  };
  recentActivity: []; // vide en MVP 1, réservé pour MVP 2
}
