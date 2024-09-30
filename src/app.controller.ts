import { AppService, JobStatus } from './app.service';
import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  NotFoundException,
  Res,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { basename } from 'path';
import * as fs from 'fs';
import * as mime from 'mime-types';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private logger: Logger, // Inject Logger
  ) {}

  @Post('optimize-version')
  async downloadAndCombine(
    @Body('url') url: string,
    @Body('fileExtension') fileExtension: string,
  ): Promise<{ id: string }> {
    this.logger.log(`Optimize request for URL: ${url.slice(0, 50)}...`);

    let jellyfinUrl = process.env.JELLYFIN_URL;

    let finalUrl: string;

    if (jellyfinUrl) {
      jellyfinUrl = jellyfinUrl.replace(/\/$/, '');
      // If JELLYFIN_URL is set, use it to replace the base of the incoming URL
      const parsedUrl = new URL(url);
      finalUrl = new URL(
        parsedUrl.pathname + parsedUrl.search,
        jellyfinUrl,
      ).toString();
    } else {
      // If JELLYFIN_URL is not set, use the incoming URL as is
      finalUrl = url;
    }

    const id = await this.appService.downloadAndCombine(
      finalUrl,
      fileExtension,
    );
    return { id };
  }

  @Get('job-status/:id')
  async getActiveJob(@Param('id') id: string): Promise<JobStatus | null> {
    return this.appService.getJobStatus(id);
  }

  @Delete('cancel-job/:id')
  async cancelJob(@Param('id') id: string) {
    this.logger.log(`Cancellation request for job: ${id}`);

    const result = this.appService.cancelJob(id);
    if (result) {
      return { message: 'Job cancelled successfully' };
    } else {
      return { message: 'Job not found or already completed' };
    }
  }

  @Get('all-jobs')
  async getAllJobs() {
    return this.appService.getAllJobs();
  }

  @Get('download/:id')
  async downloadTranscodedFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = this.appService.getTranscodedFilePath(id);

    if (!filePath) {
      throw new NotFoundException('File not found or job not completed');
    }

    const fileName = basename(filePath);
    this.logger.log(`Download request for file: ${fileName}`);

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    return new StreamableFile(fs.createReadStream(filePath));
  }
}
