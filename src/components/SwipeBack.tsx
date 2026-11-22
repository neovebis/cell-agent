import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export function SwipeBack({
  children,
  onBack,
  disabled = false,
  ignoreBottom = 0,
  footerTop,
}: {
  children: React.ReactNode;
  onBack: () => void;
  disabled?: boolean;
  ignoreBottom?: number;
  footerTop?: SharedValue<number>;
}) {
  const { width } = useWindowDimensions(),
    reduced = useReducedMotion();
  const x = useSharedValue(0),
    height = useSharedValue(0),
    leaving = useSharedValue(false);
  const callback = useRef(onBack);
  callback.current = onBack;
  const finish = useCallback(() => {
    Keyboard.dismiss();
    callback.current();
  }, []);
  useEffect(() => () => cancelAnimation(x), [x]);
  useEffect(() => {
    if (disabled) {
      cancelAnimation(x);
      x.value = 0;
      leaving.value = false;
    }
  }, [disabled, x, leaving]);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .maxPointers(1)
        .activeOffsetX(22)
        .failOffsetX(-12)
        .failOffsetY([-12, 12])
        .onTouchesDown((event, manager) => {
          if (
            leaving.value ||
            event.allTouches[0]?.y >
              (footerTop?.value || height.value - ignoreBottom)
          )
            manager.fail();
        })
        .onStart(() => {
          cancelAnimation(x);
          leaving.value = false;
        })
        .onUpdate((event) => {
          x.value = Math.max(0, Math.min(width, event.translationX));
        })
        .onEnd((event) => {
          const exit =
            x.value > width * 0.3 || (x.value > 44 && event.velocityX > 850);
          if (exit) {
            leaving.value = true;
            x.value = withTiming(
              width,
              { duration: reduced ? 0 : 180, easing: Easing.out(Easing.cubic) },
              (done) => {
                if (done) runOnJS(finish)();
              },
            );
          } else
            x.value = withSpring(0, {
              damping: 27,
              stiffness: 280,
              mass: 0.7,
              overshootClamping: true,
            });
        })
        .onFinalize(() => {
          if (!leaving.value)
            x.value = withSpring(0, {
              damping: 27,
              stiffness: 280,
              mass: 0.7,
              overshootClamping: true,
            });
        }),
    [
      disabled,
      ignoreBottom,
      footerTop,
      height,
      x,
      leaving,
      width,
      reduced,
      finish,
    ],
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: 1 - (0.12 * x.value) / width,
  }));
  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <Animated.View
        testID="chat-swipe-frame"
        onLayout={(event) => {
          height.value = event.nativeEvent.layout.height;
        }}
        style={[{ flex: 1 }, style]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
