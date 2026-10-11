import { IsString, IsOptional, IsInt, IsBoolean, IsUUID } from 'class-validator';

export class ListPatientsRequestDto {
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreatePatientRequestDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  idCard?: string;

  @IsOptional()
  @IsString()
  medicalCardNo?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsInt()
  age?: number;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
