import { Router } from "express";
import multer from "multer";
import { getSession, setSessionPhoto } from "../lib/audit-sessions.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /audit-mobile/:token/photo — public, no auth. Token IS the auth.
router.post("/:token/photo", upload.single("photo"), (req, res) => {
  const token = String(req.params.token);
  const session = getSession(token);

  if (!session || session.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ error_code: "SESSION_EXPIRED", message: "QR session has expired. Ask the desktop user to generate a new QR code." });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error_code: "NO_FILE", message: "No photo received" });
    return;
  }

  const ok = setSessionPhoto(token, file.buffer, file.mimetype);
  if (!ok) {
    res.status(410).json({ error_code: "SESSION_EXPIRED", message: "Session expired" });
    return;
  }

  res.json({ status: "ok", message: "Photo received. You can close this tab." });
});

export default router;
