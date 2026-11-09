import React from "react";
import { Composition } from "remotion";
import { Demo } from "./Demo";
import { TOTAL_FRAMES, FPS } from "./timeline";

export const Root: React.FC = () => (
  <Composition id="Demo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
