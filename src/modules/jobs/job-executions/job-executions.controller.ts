import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobExecutionsService } from './job-executions.service';

@ApiTags('job-executions')
@ApiBearerAuth()
@Controller('job-executions')
export class JobExecutionsController {
  constructor(private readonly jobExecutionsService: JobExecutionsService) {}

  @Get()
  findAll(@Query('jobId') jobId?: string) {
    return this.jobExecutionsService.findAll(jobId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobExecutionsService.findOne(id);
  }
}
