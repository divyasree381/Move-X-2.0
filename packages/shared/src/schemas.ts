import { z } from "zod";

import {
  AdminType,
  PaymentMethod,
  PaymentStatus,
  ServiceType,
  StoreType,
  UserRole,
  VehicleType,
} from "./enums.js";
import {
  CourierStatus,
  HomeServiceStatus,
  OrderStatus,
  RideStatus,
} from "./state-machines.js";

export const userRoleSchema = z.enum(UserRole);
export const adminTypeSchema = z.enum(AdminType);
export const storeTypeSchema = z.enum(StoreType);
export const vehicleTypeSchema = z.enum(VehicleType);
export const paymentMethodSchema = z.enum(PaymentMethod);
export const paymentStatusSchema = z.enum(PaymentStatus);
export const serviceTypeSchema = z.enum(ServiceType);

export const orderStatusSchema = z.enum(OrderStatus);
export const rideStatusSchema = z.enum(RideStatus);
export const courierStatusSchema = z.enum(CourierStatus);
export const homeServiceStatusSchema = z.enum(HomeServiceStatus);