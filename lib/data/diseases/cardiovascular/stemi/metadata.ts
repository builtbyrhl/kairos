import { Disease } from "../../../../engines/disease/types";
import { DataStatus } from "../../../../types/enums";

export const metadata: Pick<
  Disease,
  "id" | "version" | "lastUpdated" | "status" | "name" | "icdCode" | "category"
> = {
  id:          "stemi",
  version:     "1.0.0",
  lastUpdated: "2025-06-28",
  status:      DataStatus.Production,
  name:        "ST-Elevation Myocardial Infarction",
  icdCode:     "I21",
  category:    "cardiovascular",
};
