import { IsString, IsOptional, IsUUID, IsDateString, IsIn } from 'class-validator';

export class ListAppointmentsRequestDto {
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'confirmed', 'cancelled', 'completed'])
  status?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class CreateAppointmentRequestDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  timeSlotId?: string;

  @IsDateString()
  appointmentDate!: string;

  @IsOptional()
  @IsString()
  appointmentTime?: string;
}
