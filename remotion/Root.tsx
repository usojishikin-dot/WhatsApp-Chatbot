import { Composition, Folder } from "remotion";
import { WhatsappBotShort } from "./WhatsappBotShort";

const fps = 30;

export const RemotionRoot = () => {
  return (
    <Folder name="Ads">
      <Composition
        id="WhatsappBotShort"
        component={WhatsappBotShort}
        durationInFrames={fps * 18}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{
          businessName: "Demo SME",
          ownerPhone: "+2348000000000",
          market: "Nigeria SMEs",
        }}
      />
    </Folder>
  );
};
