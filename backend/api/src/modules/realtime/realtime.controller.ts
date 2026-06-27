import { Controller, ForbiddenException, Inject, MessageEvent, Query, Req, Sse } from "@nestjs/common";
import { from, interval, map, merge, Observable, of, switchMap, throwError } from "rxjs";

import type { RequestWithUser } from "../../common/types/authenticated-request";
import { REALTIME_PROVIDER, type RealtimeProvider } from "./realtime-provider";
import { RealtimeSubscriptionService } from "./realtime-subscription.service";

@Controller({ path: "realtime", version: "1" })
export class RealtimeController {
  constructor(
    private readonly subscriptionService: RealtimeSubscriptionService,
    @Inject(REALTIME_PROVIDER) private readonly realtimeProvider: RealtimeProvider,
  ) {}

  @Sse("subscribe")
  subscribe(@Req() request: RequestWithUser, @Query("topic") topic: string): Observable<MessageEvent> {
    if (!request.user) {
      throw new ForbiddenException("Not allowed to subscribe to this realtime topic");
    }

    return from(this.subscriptionService.canSubscribe(request.user, topic)).pipe(
      switchMap((allowed) => {
        if (!allowed) {
          return throwError(() => new ForbiddenException("Not allowed to subscribe to this realtime topic"));
        }

        return merge(
          of({ type: "connected", data: { topic } }),
          this.realtimeProvider.stream(topic).pipe(
            map((message) => ({
              id: message.id,
              type: message.type,
              data: message,
            })),
          ),
          interval(25_000).pipe(map(() => ({ type: "heartbeat", data: { topic, at: new Date().toISOString() } }))),
        );
      }),
    );
  }
}