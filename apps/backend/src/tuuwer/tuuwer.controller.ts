import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TuuwerService } from "./tuuwer.service";
import {
  SampleSizeDto,
  StratifiedSizeDto,
  SrsDto,
  StratifiedSampleDto,
  PivotBuildDto,
  PivotSampleDto,
} from "./dto/tuuwer.dto";

/**
 * /tuuwer — Unified sampling & pivot controller
 *
 * Санамсаргүй Түүвэр (Random Sampler):
 *   POST /tuuwer/sample-size          — compute n for a population
 *   POST /tuuwer/stratified-size      — compute per-stratum sizes
 *   POST /tuuwer/srs                  — perform SRSWR / SRSWOR
 *   POST /tuuwer/stratified-sample    — perform proportional / non-proportional stratified sampling
 *
 * Зээлзэс Түүвэр (Pivot / Loan sampler):
 *   POST /tuuwer/pivot                — build prefix-grouped pivot tables from spreadsheet data
 *   POST /tuuwer/pivot-sample         — extract random samples per year for a given prefix
 */
@Controller("tuuwer")
@UseGuards(JwtAuthGuard)
export class TuuwerController {
  constructor(private readonly tuuwerService: TuuwerService) {}

  // ─── Санамсаргүй Түүвэр ─────────────────────────────────────────────────────

  /**
   * POST /tuuwer/sample-size
   * Compute the required sample size n for a given population using the
   * finite-population correction formula (matches Python sampler.py logic).
   *
   * Body: { population, confidence, marginError, stdDev? }
   * Returns: { n, population, confidence, marginError }
   */
  @Post("sample-size")
  @HttpCode(HttpStatus.OK)
  computeSampleSize(@Body() dto: SampleSizeDto) {
    return this.tuuwerService.computeSampleSize(dto);
  }

  /**
   * POST /tuuwer/stratified-size
   * Compute per-stratum sample sizes for proportional stratified sampling.
   * Uses p = 0.05 (matches sampler.py stratified logic).
   *
   * Body: { strata: [{name, count}], confidence, marginError }
   * Returns: { totalN, totalSample, strata: [{name, count, sampleSize, pct}] }
   */
  @Post("stratified-size")
  @HttpCode(HttpStatus.OK)
  computeStratifiedSizes(@Body() dto: StratifiedSizeDto) {
    return this.tuuwerService.computeStratifiedSizes(dto);
  }

  /**
   * POST /tuuwer/srs
   * Perform simple random sampling with or without replacement on a flat dataset.
   *
   * Body: { data: Record<string,unknown>[], n: number, method: 'srswr'|'srswor' }
   * Returns: { method, requestedN, sampledN, data } — rows include "Түүврийн индекс"
   */
  @Post("srs")
  @HttpCode(HttpStatus.OK)
  performSrs(@Body() dto: SrsDto) {
    return this.tuuwerService.performSrs(dto);
  }

  /**
   * POST /tuuwer/stratified-sample
   * Perform proportional or non-proportional stratified sampling.
   *
   * Body: { strata: [{name, rows[]}], confidence, marginError, method: 'prop'|'nonprop' }
   * Returns: { method, totalN, totalSample, groups: [{name, count, sampleSize, rows}] }
   */
  @Post("stratified-sample")
  @HttpCode(HttpStatus.OK)
  performStratifiedSample(@Body() dto: StratifiedSampleDto) {
    return this.tuuwerService.performStratifiedSample(dto);
  }

  // ─── Зээлзэс Түүвэр (Pivot) ──────────────────────────────────────────────────

  /**
   * POST /tuuwer/pivot
   * Build per-prefix pivot tables (Year × count / Хувь% / sample size) from
   * raw spreadsheet rows.  Mirrors Python 5_Зээлзэс_Түүвэр_гаргах.py logic.
   *
   * Body: { headers, rows[][], dateCol, codeCol, confidence, marginError }
   * Returns: PrefixGroup[] sorted alphabetically by prefix
   */
  @Post("pivot")
  @HttpCode(HttpStatus.OK)
  buildPivot(@Body() dto: PivotBuildDto) {
    return this.tuuwerService.buildPivot(dto);
  }

  /**
   * POST /tuuwer/pivot-sample
   * Extract a random sample for a specific prefix, broken down by year.
   *
   * Body: { headers, rows[][], dateCol, codeCol, prefix, yearSizes: {year: n} }
   * Returns: Record<string (year), unknown[][] (sampled rows)>
   */
  @Post("pivot-sample")
  @HttpCode(HttpStatus.OK)
  buildPivotSample(@Body() dto: PivotSampleDto) {
    return this.tuuwerService.buildPivotSample(dto);
  }
}
