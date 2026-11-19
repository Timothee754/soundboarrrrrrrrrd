cmake_minimum_required(VERSION 3.21)
project(soundboarrrrrrrrrd VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Network Quick QuickControls2 Multimedia)
qt_standard_project_setup(REQUIRES 6.5)

# Le cœur (sans interface), à part pour le tester seul.
add_library(coeur STATIC
    myinstants.cpp myinstants.h
    favoris.cpp favoris.h
    micro_virtuel.cpp micro_virtuel.h)
target_link_libraries(coeur PUBLIC Qt6::Core Qt6::Network)

qt_add_executable(soundboarrrrrrrrrd main.cpp)
qt_add_qml_module(soundboarrrrrrrrrd URI Soundboard VERSION 1.0 QML_FILES Main.qml)
# Le logo de l'app, partagé avec les icônes des installateurs.
set_source_files_properties(../src-tauri/icons/128x128.png PROPERTIES QT_RESOURCE_ALIAS icone.png)
qt_add_resources(soundboarrrrrrrrrd "icone" PREFIX "/" FILES ../src-tauri/icons/128x128.png)
target_link_libraries(soundboarrrrrrrrrd PRIVATE coeur Qt6::Quick Qt6::QuickControls2 Qt6::Multimedia)

enable_testing()
add_executable(tests tests.cpp)
target_link_libraries(tests PRIVATE coeur)
# Même page réelle enregistrée que les tests Rust.
target_compile_definitions(tests PRIVATE PAGE_FR="${CMAKE_SOURCE_DIR}/../src-tauri/tests/myinstants_fr.html")
add_test(NAME coeur COMMAND tests)
