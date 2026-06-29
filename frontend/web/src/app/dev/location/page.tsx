import { LocationDemo } from "@/components/location/location-demo";

export default function DevLocationPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-sm font-semibold text-primary">MoveX dev tools</p>
        <h1 className="mt-3 text-4xl font-semibold text-foreground">Location and route tools</h1>
      </div>
      <LocationDemo />
    </main>
  );
}