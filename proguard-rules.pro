# Suppress missing class warnings for expo-av on newer Expo SDK / expo-modules-core
-dontwarn expo.modules.av.**
-dontwarn expo.modules.core.interfaces.services.KeepAwakeManager
-dontwarn expo.modules.kotlin.types.AnyTypeProvider
-dontwarn expo.modules.kotlin.types.LazyKType
-keep class expo.modules.av.** { *; }
-keep interface expo.modules.core.interfaces.services.KeepAwakeManager { *; }

