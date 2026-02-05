import bpy
import math
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "game", "models")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Basic materials
def make_mat(name, color, metallic=0.2, roughness=0.35, emission=None, emission_strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

MAT_HULL = make_mat("Hull", (0.12, 0.18, 0.35), metallic=0.4, roughness=0.35)
MAT_GLOW = make_mat("Glow", (0.1, 0.8, 1.0), metallic=0.0, roughness=0.2, emission=(0.1, 0.8, 1.0), emission_strength=3.0)
MAT_ACCENT = make_mat("Accent", (1.0, 0.4, 0.7), metallic=0.2, roughness=0.25, emission=(1.0, 0.4, 0.7), emission_strength=2.0)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def add_hull(scale=(1.2, 2.0, 0.4)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = scale
    obj.data.materials.append(MAT_HULL)
    return obj

def add_wing(x, y, z, scale=(0.6, 1.4, 0.08), tilt=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.scale = scale
    obj.rotation_euler[1] = tilt
    obj.data.materials.append(MAT_HULL)
    return obj

def add_cockpit(scale=(0.3, 0.5, 0.2), z=0.25):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0.4, z))
    obj = bpy.context.active_object
    obj.scale = scale
    obj.data.materials.append(MAT_ACCENT)
    return obj

def add_engine(x, y, z, scale=(0.18, 0.18, 0.3)):
    bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.scale = scale
    obj.rotation_euler[0] = math.radians(90)
    obj.data.materials.append(MAT_GLOW)
    return obj

def build_ship(name, tier=1):
    clear_scene()
    hull = add_hull(scale=(1.0 + tier*0.08, 1.8 + tier*0.18, 0.35 + tier*0.03))
    add_wing(0.8, 0.2, 0.0, scale=(0.5 + tier*0.05, 1.2 + tier*0.1, 0.08), tilt=math.radians(12))
    add_wing(-0.8, 0.2, 0.0, scale=(0.5 + tier*0.05, 1.2 + tier*0.1, 0.08), tilt=math.radians(-12))
    add_cockpit(scale=(0.25 + tier*0.03, 0.4 + tier*0.04, 0.18 + tier*0.02))
    add_engine(0.35, -0.7, 0.0, scale=(0.16, 0.16, 0.35 + tier*0.05))
    add_engine(-0.35, -0.7, 0.0, scale=(0.16, 0.16, 0.35 + tier*0.05))

    # extra fins for higher tiers
    if tier >= 3:
        add_wing(0.0, 0.8, 0.18, scale=(0.2, 0.6, 0.06), tilt=0.0)
    if tier >= 4:
        add_engine(0.0, -0.9, 0.1, scale=(0.2, 0.2, 0.4))

    # export
    filepath = os.path.join(OUTPUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB', export_apply=True)

def main():
    build_ship("scout", tier=1)
    build_ship("striker", tier=2)
    build_ship("ranger", tier=3)
    build_ship("astra", tier=3)
    build_ship("warden", tier=4)
    build_ship("valkyrie", tier=5)

if __name__ == "__main__":
    main()
