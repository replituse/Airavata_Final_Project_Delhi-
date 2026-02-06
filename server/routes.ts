import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { exec } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // WHAMO Execution Route
  app.post("/api/whamo/execute", async (req, res) => {
    try {
      const { inpContent } = req.body;
      if (!inpContent) {
        return res.status(400).json({ message: "No .inp content provided" });
      }

      const tempDir = os.tmpdir();
      const baseName = `whamo_${Date.now()}`;
      const inpFile = path.join(tempDir, `${baseName}.inp`);
      const outFile = path.join(tempDir, `${baseName}.out`);
      const exePath = path.resolve(process.cwd(), "bin/whamo.exe");

      // Write the .inp file
      await writeFile(inpFile, inpContent);

      // Execute WHAMO.EXE
      // Usage: whamo.exe input_file output_file
      // On Replit, we use 'wine' to execute Windows binaries.
      exec(`wine ${exePath} ${inpFile} ${outFile}`, async (error, stdout, stderr) => {
        try {
          // Check if .out file was created even if there's an error code
          let outContent = "";
          try {
            outContent = await readFile(outFile, "utf-8");
          } catch (e) {
            // If .out file doesn't exist, it failed
            return res.status(500).json({ 
              message: "WHAMO execution failed to produce output", 
              error: error?.message,
              stderr 
            });
          }

          // Cleanup temp files
          await Promise.all([
            unlink(inpFile).catch(() => {}),
            unlink(outFile).catch(() => {})
          ]);

          res.json({ outContent });
        } catch (innerErr) {
          res.status(500).json({ message: "Error processing results" });
        }
      });
    } catch (err) {
      res.status(500).json({ message: "Server error during WHAMO execution" });
    }
  });

  // Project Routes
  app.get(api.projects.list.path, async (req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const project = await storage.createProject(input);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.projects.update.path, async (req, res) => {
    try {
      const input = api.projects.update.input.parse(req.body);
      const project = await storage.updateProject(Number(req.params.id), input);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.projects.delete.path, async (req, res) => {
    await storage.deleteProject(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
