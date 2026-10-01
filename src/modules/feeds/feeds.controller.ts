import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateFeedDto } from './dto/create-feed.dto';
import { FindFeedsQueryDto } from './dto/find-feeds-query.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { FeedsService } from './feeds.service';

@ApiTags('feeds')
@ApiBearerAuth()
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Post()
  create(@Body() dto: CreateFeedDto) {
    return this.feedsService.create(dto);
  }

  @Get()
  findAll(@Query() query: FindFeedsQueryDto) {
    return this.feedsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.feedsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFeedDto) {
    return this.feedsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.feedsService.remove(id);
  }
}
