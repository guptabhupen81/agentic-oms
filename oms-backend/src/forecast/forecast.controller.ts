import { Roles } from '../auth/roles.decorator';
import { DISTRIBUTOR_SIDE_ROLES } from '../auth/roles.constants';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ForecastService, ForecastFactorInput, RunForecastInput } from './forecast.service';

@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('forecast-factors')
export class ForecastFactorController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get()
  list() {
    return this.forecastService.listFactors();
  }

  @Post()
  create(@Body() body: ForecastFactorInput) {
    return this.forecastService.createFactor(body);
  }
}

@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('forecasts')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get()
  list() {
    return this.forecastService.listForecasts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.forecastService.findForecastById(id);
  }

  @Post()
  run(@Body() body: RunForecastInput) {
    return this.forecastService.runForecast(body);
  }
}
