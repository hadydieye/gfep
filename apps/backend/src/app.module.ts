import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { AccessModule } from './access/access.module.js';
import { AdAuthModule } from './ad-auth/ad-auth.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { SessionMiddleware } from './auth/session.middleware.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { PermissionGuard } from './rbac/guards/permission.guard.js';
import { RoleGuard } from './rbac/guards/roles.guard.js';
import { RbacModule } from './rbac/rbac.module.js';
import { ForbiddenAuditFilter } from './security/forbidden-audit.filter.js';
import { SecurityModule } from './security/security.module.js';
// SettingsModule est @Global() ET importé dans AuthModule pour que AuthService reçoive SettingsService
import { SettingsModule } from './settings/settings.module.js';
// LabModule : vulnérabilités pédagogiques (R-LAB-2). Importé uniquement si LAB_MODE=true.
// Quand LAB_MODE !== 'true' : aucune route de lab n'existe, aucun code vulnérable chargé.
import { LabModule } from './lab/lab.module.js';

// Évalué une seule fois au chargement du module — jamais réévalué en cours de vie du processus.
const labImports = process.env.LAB_MODE === 'true' ? [LabModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      // Un throttler par point d'entrée d'authentification : 5 tentatives / 15 min / IP (TRD §6)
      throttlers: [
        { name: 'login', ttl: 900000, limit: 5 },
        { name: 'login-ad', ttl: 900000, limit: 5 },
        // Changement de mot de passe : 5 essais / 15 min par compte (N14)
        { name: 'password-change', ttl: 900000, limit: 5 },
      ],
      errorMessage: 'Trop de tentatives. Réessayez dans quelques minutes.',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    SecurityModule,
    RbacModule,
    DashboardModule,
    DocumentsModule,
    EmployeesModule,
    DepartmentsModule,
    FinanceModule,
    AccessModule,
    AdAuthModule,
    ProfileModule,
    SettingsModule,
    // LabModule conditionnel : voir labImports ci-dessus. En production, ce tableau est vide.
    ...labImports,
  ],
  // Interdiction par défaut : session, puis rôle, puis permission, sur toutes les routes.
  // Exceptions explicites : @Public() et @AuthenticatedOnly().
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // repeated_forbidden (M20) : compte les 403 par compte, puis renvoie le 403 standard
    { provide: APP_FILTER, useClass: ForbiddenAuditFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(cookieParser(), SessionMiddleware)
      .exclude({ path: 'auth/login', method: RequestMethod.POST }, { path: 'auth/login-ad', method: RequestMethod.POST })
      .forRoutes('{*path}');
  }
}
