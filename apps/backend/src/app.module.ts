import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth/auth.module.js';
import { SessionMiddleware } from './auth/session.middleware.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RbacModule } from './rbac/rbac.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'login', ttl: 900000, limit: 5 }],
      errorMessage: 'Trop de tentatives. Réessayez dans quelques minutes.',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    RbacModule,
    DashboardModule,
    EmployeesModule,
    DepartmentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(cookieParser(), SessionMiddleware)
      .exclude({ path: 'auth/login', method: RequestMethod.POST })
      .forRoutes('{*path}');
  }
}
