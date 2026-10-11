import { Module } from '@nestjs/common';
import { DepartmentsController, DoctorsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController, DoctorsController],
  providers: [DepartmentsService],
})
export class DepartmentsModule {}
