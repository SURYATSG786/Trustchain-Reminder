import { analyzePdf } from "../services/pdf.service.mjs";
import { verifyNptel } from "../services/nptel.service.mjs";

export function createInspectionController({ inspectionInput }) {
  return {
    verifyCertificate: async (req, res) => {
      const { bytes } = await inspectionInput(req);
      res.json(await verifyNptel(bytes));
    },

    analyzeDocument: async (req, res) => {
      const { bytes, name } = await inspectionInput(req);
      res.json(await analyzePdf(bytes, name));
    },
  };
}
