import { ref, readonly } from 'vue';
import RapierAdapter from '@/core/physics/rapier/RapierAdapter';

const physicsWorld = ref(null);
const isInitialized = ref(false);
const isLoading = ref(false);

/**
 * Composable for managing the Rapier physics world.
 * Initializes the RapierAdapter and provides access to the world and adapter.
 */
export function useRapierPhysics() {

  const initialize = async (options = {}) => {
    if (isInitialized.value || isLoading.value) {
      console.warn('[useRapierPhysics] Initialization already in progress or completed.');
      return;
    }
    
    isLoading.value = true;
    console.log('[useRapierPhysics] Initializing Rapier physics...');
    
    try {
      await RapierAdapter.init(options);
      physicsWorld.value = RapierAdapter.world; // Store the Rapier world instance
      isInitialized.value = true;
      console.log('[useRapierPhysics] Rapier physics initialized successfully.');
    } catch (error) {
      console.error('[useRapierPhysics] Failed to initialize Rapier physics:', error);
      isInitialized.value = false; // Ensure flag is reset on error
    } finally {
      isLoading.value = false;
    }
  };

  const dispose = () => {
    if (!isInitialized.value) return;
    console.log('[useRapierPhysics] Disposing Rapier physics...');
    RapierAdapter.dispose();
    physicsWorld.value = null;
    isInitialized.value = false;
  };

  const update = (deltaTime) => {
    if (!isInitialized.value) return;
    RapierAdapter.update(deltaTime);
  };

  return {
    physicsWorld: readonly(physicsWorld), // Provide read-only access outside
    isInitialized: readonly(isInitialized),
    isLoading: readonly(isLoading),
    adapter: RapierAdapter, // Provide direct access to the adapter singleton
    initialize,
    dispose,
    update
  };
} 