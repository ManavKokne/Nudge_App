import { NextResponse } from "next/server";

export function ok(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error, status = 400, details) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );
}
