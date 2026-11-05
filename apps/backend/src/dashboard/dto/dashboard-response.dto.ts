export class DashboardResponseDto {
  role: string;
  indicators: {
    totalEmployees?: number;
    departmentEmployees?: number;
    departmentName?: string;
  };
  recentActivity: []; // vide en MVP 1, réservé pour MVP 2
  recentDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  pendingDocuments?: Array<{ id: string; title: string; createdAt: string }>;
}
