cmake_minimum_required(VERSION 3.21)
project(soundboarrrrrrrrrd LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Network Quick QuickControls2 Multimedia)
qt_standard_project_setup(REQUIRES 6.5)

# La source myinstants à part, pour la tester sans l'interface.
add_library(myinstants STATIC myinstants.cpp myinstants.h)
target_link_libraries(myinstants PUBLIC Qt6::Core Qt6::Network)

qt_add_executable(soundboarrrrrrrrrd main.cpp)
qt_add_qml_module(soundboarrrrrrrrrd URI Soundboard VERSION 1.0 QML_FILES Main.qml)
target_link_libraries(soundboarrrrrrrrrd PRIVATE myinstants Qt6::Quick Qt6::QuickControls2 Qt6::Multimedia)

enable_testing()
add_executable(test_myinstants test_myinstants.cpp)
target_link_libraries(test_myinstants PRIVATE myinstants)
# Même page réelle enregistrée que les tests Rust.
target_compile_definitions(test_myinstants PRIVATE PAGE_FR="${CMAKE_SOURCE_DIR}/../src-tauri/tests/myinstants_fr.html")
add_test(NAME myinstants COMMAND test_myinstants)
