import subprocess
import os
import shutil
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = "recordings"

def assemble():
    print("--- Assembling Master Tutorial Video ---")
    
    video_input = os.path.join(OUT_DIR, "tata_nexon_production_demo.webm")
    audio_input = os.path.join(OUT_DIR, "master_voiceover.mp3")
    main_with_audio = os.path.join(OUT_DIR, "main_with_audio.mp4")
    outro_video = os.path.join(OUT_DIR, "outro_card.mp4")
    final_output = os.path.join(OUT_DIR, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_Master.mp4")

    # Step 1: Merge screen capture webm with voiceover audio into mp4
    print("Step 1: Merging screencast video with voiceover...")
    cmd1 = [
        FFMPEG, "-y",
        "-i", video_input,
        "-i", audio_input,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        main_with_audio
    ]
    res1 = subprocess.run(cmd1, capture_output=True, text=True)
    if res1.returncode != 0:
        print("Step 1 failed:", res1.stderr)
        return
    print("Step 1 completed: main_with_audio.mp4")

    # Step 2: Concatenate main_with_audio + outro_card
    print("Step 2: Concatenating main video with 5s branded outro...")
    concat_list_path = os.path.join(OUT_DIR, "concat_list.txt")
    with open(concat_list_path, "w", encoding="utf-8") as f:
        f.write(f"file '{os.path.abspath(main_with_audio).replace(os.sep, '/')}'\n")
        f.write(f"file '{os.path.abspath(outro_video).replace(os.sep, '/')}'\n")

    cmd2 = [
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list_path,
        "-c", "copy",
        final_output
    ]
    res2 = subprocess.run(cmd2, capture_output=True, text=True)
    if res2.returncode != 0:
        print("Concat copy failed, attempting re-encode concat:", res2.stderr)
        # Re-encode concat fallback
        cmd2_reencode = [
            FFMPEG, "-y",
            "-i", main_with_audio,
            "-i", outro_video,
            "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            final_output
        ]
        res2_reencode = subprocess.run(cmd2_reencode, capture_output=True, text=True)
        if res2_reencode.returncode != 0:
            print("Step 2 re-encode failed:", res2_reencode.stderr)
            return

    file_size = os.path.getsize(final_output)
    print(f"SUCCESS! Master Video created at:\n{final_output}\nSize: {file_size / (1024*1024):.2f} MB")

    # Also copy to brain artifact directory for persistent download
    brain_dir = r"C:\Users\Manasi\.gemini\antigravity\brain\1eaa2f18-3c26-47c1-89d7-634ba22ffbad"
    brain_target = os.path.join(brain_dir, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_Master.mp4")
    shutil.copyfile(final_output, brain_target)
    print(f"Copied to Brain Artifacts at: {brain_target}")

if __name__ == "__main__":
    assemble()
