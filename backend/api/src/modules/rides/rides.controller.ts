import { Inject, Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser, RequestWithUser } from "../../common/types/authenticated-request";
import type { HomeServiceCatalogQueryDto} from "./dto/rides.dto";
import { CreateCourierDto, CreateHomeServiceDto, CreateRideDto, CourierEstimateDto, HomeServiceEstimateDto, RideCancelDto, RideEstimateDto, RideOtpDto, RideRatingDto, RidesQueryDto } from "./dto/rides.dto";
import { RidesService } from "./rides.service";

@ApiTags("Rides")
@ApiExtraModels(CreateRideDto, CreateCourierDto, CreateHomeServiceDto, CourierEstimateDto, HomeServiceEstimateDto, RideCancelDto, RideEstimateDto, RideOtpDto, RideRatingDto, RidesQueryDto)
@Controller({ version: "1" })
export class RidesController {
  constructor(@Inject(RidesService) private readonly ridesService: RidesService) {}

  @Post("rides/estimate")
  estimate(@Body() body: RideEstimateDto) {
    return this.ridesService.estimate(body);
  }

  @Post("rides")
  createRide(@Req() request: RequestWithUser, @Body() body: CreateRideDto) {
    return this.ridesService.createRide(this.getUser(request), body);
  }


  @Post("couriers/estimate")
  estimateCourier(@Body() body: CourierEstimateDto) {
    return this.ridesService.estimateCourier(body);
  }

  @Post("couriers")
  createCourier(@Req() request: RequestWithUser, @Body() body: CreateCourierDto) {
    return this.ridesService.createCourier(this.getUser(request), body);
  }


  @Get("home-services/catalog")
  listHomeServiceCatalog(@Query() query: HomeServiceCatalogQueryDto) {
    return this.ridesService.listHomeServiceCatalog(query);
  }

  @Post("home-services/estimate")
  estimateHomeService(@Body() body: HomeServiceEstimateDto) {
    return this.ridesService.estimateHomeService(body);
  }

  @Post("home-services")
  createHomeService(@Req() request: RequestWithUser, @Body() body: CreateHomeServiceDto) {
    return this.ridesService.createHomeService(this.getUser(request), body);
  }

  @Get("home-services/professional/queue")
  listHomeServiceQueue(@Req() request: RequestWithUser) {
    return this.ridesService.listHomeServiceQueue(this.getUser(request));
  }

  @Post("home-services/professional/:bookingId/accept")
  acceptHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string) {
    return this.ridesService.acceptHomeService(this.getUser(request), bookingId);
  }

  @Post("home-services/professional/:bookingId/arrive")
  arriveHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string) {
    return this.ridesService.arriveHomeService(this.getUser(request), bookingId);
  }

  @Post("home-services/professional/:bookingId/start")
  startHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string, @Body() body: RideOtpDto) {
    return this.ridesService.startHomeService(this.getUser(request), bookingId, body);
  }

  @Post("home-services/professional/:bookingId/complete")
  completeHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string) {
    return this.ridesService.completeHomeService(this.getUser(request), bookingId);
  }

  @Post("home-services/:bookingId/cancel")
  cancelHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string, @Body() body: RideCancelDto) {
    return this.ridesService.cancelHomeService(this.getUser(request), bookingId, body);
  }

  @Post("home-services/:bookingId/rating")
  rateHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string, @Body() body: RideRatingDto) {
    return this.ridesService.rateHomeService(this.getUser(request), bookingId, body);
  }

  @Get("home-services")
  listHomeServices(@Req() request: RequestWithUser, @Query() query: RidesQueryDto) {
    return this.ridesService.listHomeServices(this.getUser(request), query);
  }

  @Get("home-services/:bookingId")
  getHomeService(@Req() request: RequestWithUser, @Param("bookingId") bookingId: string) {
    return this.ridesService.getHomeService(this.getUser(request), bookingId);
  }
  @Get("couriers/delivery/queue")
  listCourierQueue(@Req() request: RequestWithUser) {
    return this.ridesService.listCourierQueue(this.getUser(request));
  }

  @Post("couriers/delivery/:courierId/accept")
  acceptCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string) {
    return this.ridesService.acceptCourier(this.getUser(request), courierId);
  }

  @Post("couriers/delivery/:courierId/arrive")
  arriveCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string) {
    return this.ridesService.arriveCourier(this.getUser(request), courierId);
  }

  @Post("couriers/delivery/:courierId/pickup")
  pickupCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string, @Body() body: RideOtpDto) {
    return this.ridesService.pickupCourier(this.getUser(request), courierId, body);
  }

  @Post("couriers/delivery/:courierId/deliver")
  deliverCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string, @Body() body: RideOtpDto) {
    return this.ridesService.deliverCourier(this.getUser(request), courierId, body);
  }

  @Post("couriers/:courierId/cancel")
  cancelCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string, @Body() body: RideCancelDto) {
    return this.ridesService.cancelCourier(this.getUser(request), courierId, body);
  }

  @Post("couriers/:courierId/rating")
  rateCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string, @Body() body: RideRatingDto) {
    return this.ridesService.rateCourier(this.getUser(request), courierId, body);
  }

  @Get("couriers")
  listCouriers(@Req() request: RequestWithUser, @Query() query: RidesQueryDto) {
    return this.ridesService.listCouriers(this.getUser(request), query);
  }

  @Get("couriers/:courierId")
  getCourier(@Req() request: RequestWithUser, @Param("courierId") courierId: string) {
    return this.ridesService.getCourier(this.getUser(request), courierId);
  }
  @Get("rides/driver/queue")
  listDriverQueue(@Req() request: RequestWithUser) {
    return this.ridesService.listDriverQueue(this.getUser(request));
  }

  @Post("rides/driver/:rideId/accept")
  acceptRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string) {
    return this.ridesService.acceptRide(this.getUser(request), rideId);
  }

  @Post("rides/driver/:rideId/arrive")
  arriveRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string) {
    return this.ridesService.arriveRide(this.getUser(request), rideId);
  }

  @Post("rides/driver/:rideId/start")
  startRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string, @Body() body: RideOtpDto) {
    return this.ridesService.startRide(this.getUser(request), rideId, body);
  }

  @Post("rides/driver/:rideId/complete")
  completeRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string) {
    return this.ridesService.completeRide(this.getUser(request), rideId);
  }

  @Post("rides/:rideId/cancel")
  cancelRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string, @Body() body: RideCancelDto) {
    return this.ridesService.cancelRide(this.getUser(request), rideId, body);
  }

  @Post("rides/:rideId/rating")
  rateRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string, @Body() body: RideRatingDto) {
    return this.ridesService.rateRide(this.getUser(request), rideId, body);
  }

  @Get("rides")
  listRides(@Req() request: RequestWithUser, @Query() query: RidesQueryDto) {
    return this.ridesService.listRides(this.getUser(request), query);
  }

  @Get("rides/:rideId")
  getRide(@Req() request: RequestWithUser, @Param("rideId") rideId: string) {
    return this.ridesService.getRide(this.getUser(request), rideId);
  }

  private getUser(request: RequestWithUser): AuthenticatedUser {
    if (!request.user) {
      throw new Error("Authenticated request is missing user context.");
    }

    return request.user;
  }
}