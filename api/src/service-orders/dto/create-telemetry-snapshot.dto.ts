import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// RF-13 — snapshot pontual anexado à OS. O fluxo contínuo/bruto vai por
// MQTT direto ao LARCC (RF-14), não passa por aqui.
export class CreateTelemetrySnapshotDto {
  @IsInt()
  mileage: number;

  @IsOptional()
  @IsNumber()
  engineTemperature?: number;

  @IsOptional()
  @IsNumber()
  batteryVoltage?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  dtcCodes?: string[];

  @IsDateString()
  capturedAt: string;
}
