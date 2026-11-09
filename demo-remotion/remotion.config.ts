import { Config } from "@remotion/cli/config";
Config.setBrowserExecutable("/usr/bin/google-chrome");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setConcurrency(2);                          // hemat RAM (sebelumnya 6)
Config.setOffthreadVideoCacheSizeInBytes(256 * 1024 * 1024); // batasi cache frame video 256 MB
Config.setOverwriteOutput(true);
