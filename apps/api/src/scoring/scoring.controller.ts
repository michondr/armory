import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { EnvService } from '../config/env';
import { ImagesService } from '../images/images.service';

const MAX_BYTES = 15 * 1024 * 1024;

interface ScoreTestResult {
  imagePath: string;
  shots: { x: number; y: number; ring: number }[];
  total: number;
}

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(
    private readonly images: ImagesService,
    private readonly env: EnvService,
  ) {}

  /** Ad-hoc detection: store the upload, run the scorer synchronously, return what it found. */
  @Post('test')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async test(
    @CurrentUser() user: AuthedUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { shotCount?: string; maxScore?: string },
  ): Promise<ScoreTestResult> {
    if (!file) throw new BadRequestException('No file uploaded (field "file")');
    const filename = await this.images.save(user.id, file);

    const res = await fetch(`${this.env.values.SCORER_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: `${user.id}/${filename}`,
        shotCount: Number(body?.shotCount) || 0,
        maxScore: Number(body?.maxScore) || 10,
      }),
    });
    if (!res.ok) throw new BadRequestException(`Scorer error: ${await res.text()}`);

    const data = (await res.json()) as {
      shots: { x: number; y: number; ring: number }[];
      total: number;
    };
    return { imagePath: filename, shots: data.shots, total: data.total };
  }
}
