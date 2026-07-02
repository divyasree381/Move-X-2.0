import { LocationDemo } from "@/components/location/location-demo";

export default function DevLocationPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">MoveX map preview</p>
          <h1 className="mt-3 text-4xl font-medium tracking-normal text-foreground sm:text-5xl">A premium map flow for rides, courier, and delivery addresses.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Set pickup and drop, refine the pin, review route feedback, and keep manual coordinates tucked inside advanced controls.</p>
        </div>
        <LocationDemo />
      </div>
    </main>
  );
}

