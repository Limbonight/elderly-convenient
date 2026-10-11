import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  idCard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  medicalCardNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsInt()
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  relationship?: string;

  @IsString()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
