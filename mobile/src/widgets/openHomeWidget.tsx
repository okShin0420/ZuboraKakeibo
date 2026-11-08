import { AccessoryWidgetBackground, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { clipShape, containerBackground, font, foregroundStyle, frame, lineLimit, monospacedDigit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type OpenHomeWidgetProps = {
  amountText: string;
  daysText: string;
  dogUri: string;
};

function OpenHomeWidget({ amountText, daysText }: OpenHomeWidgetProps) {
  'widget';
  const amount = amountText.startsWith('¥') ? amountText.slice(1) : amountText;
  const amountSize = amount.length >= 10 ? 11 : amount.length >= 8 ? 14 : amount.length >= 7 ? 17 : 21;
  return (
    <ZStack modifiers={[
      widgetURL('zuborakakeibo://home'),
      containerBackground({ type: 'material', material: 'regular' }, 'widget'),
      clipShape('roundedRectangle', 16),
    ]}>
      <AccessoryWidgetBackground />
      <VStack spacing={1} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
        <Text modifiers={[font({ size: amountSize, weight: 'semibold', design: 'rounded' }), monospacedDigit(), lineLimit(1), foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{amountText}</Text>
        <Text modifiers={[font({ size: 11, weight: 'semibold', design: 'rounded' }), lineLimit(1), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{daysText}</Text>
      </VStack>
    </ZStack>
  );
}

// expo-widgets saves initial props in iOS UserDefaults, which cannot store null values.
export default createWidget('OpenHomeWidgetV2', OpenHomeWidget, { amountText: '¥—', daysText: '残り—日', dogUri: '' });
