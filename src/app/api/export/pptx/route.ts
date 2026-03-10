import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import {
  buildSaturationSlide,
  buildAvailabilitySlide,
  buildGroupSizeSlide,
  buildDeskOverviewSlide,
  buildDeskByFloorSlide,
  buildDeskByNeighborhoodSlide,
} from "@/lib/pptx-slides";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pptx = new PptxGenJS();
    pptx.title = "Chime Space Usage Report";
    pptx.author = "Chime";

    // Slide 1: Title
    const titleSlide = pptx.addSlide();
    titleSlide.addText("Space Usage Analytics", {
      x: 1, y: 2, w: 8, h: 1.5,
      fontSize: 28, bold: true, color: "333333", align: "center",
    });
    titleSlide.addText(`Generated ${new Date().toLocaleDateString()}`, {
      x: 1, y: 3.5, w: 8, h: 0.5,
      fontSize: 14, color: "666666", align: "center",
    });

    // Build slides from provided data
    if (body.meetingRoomSaturation || body.deskSaturation) {
      buildSaturationSlide(pptx, "Space Saturation", body.meetingRoomSaturation, body.deskSaturation);
    }

    if (body.availability) {
      buildAvailabilitySlide(pptx, body.availability);
    }

    if (body.groupSize) {
      buildGroupSizeSlide(pptx, body.groupSize);
    }

    if (body.deskSummary) {
      buildDeskOverviewSlide(pptx, body.deskSummary);
    }

    if (body.floorSummary) {
      buildDeskByFloorSlide(pptx, body.floorSummary);
    }

    if (body.neighborhoodSummary) {
      buildDeskByNeighborhoodSlide(pptx, body.neighborhoodSummary);
    }

    if (body.openCollabSaturation) {
      buildSaturationSlide(pptx, "Open Collaboration Saturation", undefined, undefined, body.openCollabSaturation);
    }

    const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="chime-report-${new Date().toISOString().slice(0, 10)}.pptx"`,
      },
    });
  } catch (error) {
    console.error("PPTX export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
