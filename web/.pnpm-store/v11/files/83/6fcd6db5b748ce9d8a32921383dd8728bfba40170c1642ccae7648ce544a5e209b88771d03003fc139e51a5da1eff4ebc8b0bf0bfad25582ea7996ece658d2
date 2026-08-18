//#endregion
//#region src/mp4boxbuffer.d.ts
declare class MP4BoxBuffer extends ArrayBuffer {
  fileStart: number;
  usedBytes?: number;
  constructor(byteLength: number);
  static fromArrayBuffer(buffer: ArrayBufferLike, fileStart: number): MP4BoxBuffer;
}
//#endregion
//#region src/containerBox.d.ts
declare class ContainerBox extends Box {
  subBoxNames?: ReadonlyArray<string>;
  /** @bundle box-write.js */
  write(stream: MultiBufferStream | DataStream): void;
  /** @bundle box-print.js */
  print(output: Output): void;
  /** @bundle box-parse.js */
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/co64.d.ts
declare class co64Box extends FullBox {
  static readonly fourcc: "co64";
  box_name: "ChunkLargeOffsetBox";
  chunk_offsets: Array<number>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/co64.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/cslg.d.ts
declare class cslgBox extends FullBox {
  static readonly fourcc: "cslg";
  box_name: "CompositionToDecodeBox";
  compositionToDTSShift: number;
  leastDecodeToDisplayDelta: number;
  greatestDecodeToDisplayDelta: number;
  compositionStartTime: number;
  compositionEndTime: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/cslg.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/ctts.d.ts
declare class cttsBox extends FullBox {
  static readonly fourcc: "ctts";
  box_name: "CompositionOffsetBox";
  sample_counts: Array<number>;
  sample_offsets: Array<number>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/ctts.js */
  write(stream: MultiBufferStream): void;
  /** @bundle box-unpack.js */
  unpack(samples: Array<Sample>): void;
}
//#endregion
//#region src/boxes/elng.d.ts
declare class elngBox extends FullBox {
  static readonly fourcc: "elng";
  box_name: "ExtendedLanguageBox";
  extended_language: string;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/elng.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/elst.d.ts
declare class elstBox extends FullBox {
  static readonly fourcc: "elst";
  box_name: "EditListBox";
  entries: Array<Entry>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/elst.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/hdlr.d.ts
declare class hdlrBox extends FullBox {
  static readonly fourcc: "hdlr";
  box_name: "HandlerBox";
  version: number;
  handler: string;
  name: string;
  flags: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/hldr.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/ipma.d.ts
interface Assocation {
  id: number;
  props: Array<{
    property_index: number;
    essential: boolean;
  }>;
}
declare class ipmaBox extends FullBox {
  static readonly fourcc: "ipma";
  box_name: "ItemPropertyAssociationBox";
  associations: Array<Assocation>;
  version: number;
  flags: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/kind.d.ts
declare class kindBox extends FullBox {
  static readonly fourcc: "kind";
  box_name: "KindBox";
  schemeURI: string;
  value: string;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/kind.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/mdhd.d.ts
declare class mdhdBox extends FullBox {
  static readonly fourcc: "mdhd";
  box_name: "MediaHeaderBox";
  creation_time: number;
  modification_time: number;
  timescale: number;
  duration: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/mdhd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/mehd.d.ts
declare class mehdBox extends FullBox {
  static readonly fourcc: "mehd";
  box_name: "MovieExtendsHeaderBox";
  fragment_duration: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/mehd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/mvhd.d.ts
declare class mvhdBox extends FullBox {
  static readonly fourcc: "mvhd";
  box_name: "MovieHeaderBox";
  creation_time: number;
  modification_time: number;
  timescale: number;
  duration: number;
  rate: number;
  volume: number;
  next_track_id: number;
  matrix: Matrix;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/mvhd.js */
  write(stream: MultiBufferStream): void;
  /** @bundle box-print.js */
  print(output: Output): void;
}
//#endregion
//#region src/boxes/pssh.d.ts
declare class psshBox extends FullBox {
  static readonly fourcc: "pssh";
  box_name: "ProtectionSystemSpecificHeaderBox";
  system_id: string;
  kid: Array<string>;
  protection_data?: Uint8Array;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sbgp.d.ts
interface Entry$1 {
  sample_count: number;
  group_description_index: number;
}
declare class sbgpBox extends FullBox {
  static readonly fourcc: "sbgp";
  box_name: "SampleToGroupBox";
  grouping_type: string;
  grouping_type_parameter: number;
  entries: Array<Entry$1>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/sbgp.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sdtp.d.ts
declare class sdtpBox extends FullBox {
  static readonly fourcc: "sdtp";
  box_name: "SampleDependencyTypeBox";
  is_leading: Array<number>;
  sample_depends_on: Array<number>;
  sample_is_depended_on: Array<number>;
  sample_has_redundancy: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sgpd.d.ts
declare class sgpdBox extends FullBox {
  static readonly fourcc: "sgpd";
  box_name: "SampleGroupDescriptionBox";
  grouping_type: 'alst' | 'avll' | 'avss' | 'dtrt' | 'mvif' | 'prol' | 'rap' | 'rash' | 'roll' | 'scif' | 'scnm' | 'seig' | 'stsa' | 'sync' | 'tele' | 'tsas' | 'tscl' | 'vipr' | (string & {});
  default_length: number;
  default_group_description_index: number;
  default_sample_description_index: number;
  entries: Array<SampleGroupEntry>;
  used: boolean;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/sgpd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stco.d.ts
declare class stcoBox extends FullBox {
  static readonly fourcc: "stco";
  box_name: "ChunkOffsetBox";
  chunk_offsets: Array<number>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writings/stco.js */
  write(stream: MultiBufferStream): void;
  /** @bundle box-unpack.js */
  unpack(samples: Array<Sample>): void;
}
//#endregion
//#region src/boxes/stdp.d.ts
declare class stdpBox extends FullBox {
  static readonly fourcc: "stdp";
  box_name: "DegradationPriorityBox";
  priority: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stsc.d.ts
declare class stscBox extends FullBox {
  static readonly fourcc: "stsc";
  box_name: "SampleToChunkBox";
  first_chunk: Array<number>;
  samples_per_chunk: Array<number>;
  sample_description_index: Array<number>;
  parse(stream: MultiBufferStream): void;
  write(stream: MultiBufferStream): void;
  unpack(samples: Array<Sample>): void;
}
//#endregion
//#region src/boxes/av1C.d.ts
declare class av1CBox extends Box {
  static readonly fourcc: "av1C";
  box_name: "AV1CodecConfigurationBox";
  version: number;
  seq_profile: number;
  seq_level_idx_0: number;
  seq_tier_0: number;
  high_bitdepth: number;
  twelve_bit: number;
  monochrome: number;
  chroma_subsampling_x: number;
  chroma_subsampling_y: number;
  chroma_sample_position: number;
  reserved_1: number;
  initial_presentation_delay_present: number;
  initial_presentation_delay_minus_one: number;
  reserved_2: number;
  configOBUs: Uint8Array;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/displays/parameterSetArray.d.ts
declare class ParameterSetArray extends Array<Nalu> {
  toString(): string;
}
//#endregion
//#region src/boxes/avcC.d.ts
declare class avcCBox extends Box {
  static readonly fourcc: "avcC";
  box_name: "AVCConfigurationBox";
  configurationVersion: number;
  AVCProfileIndication: number;
  profile_compatibility: number;
  AVCLevelIndication: number;
  lengthSizeMinusOne: number;
  nb_SPS_nalus: number;
  SPS: ParameterSetArray;
  nb_PPS_nalus: number;
  PPS: ParameterSetArray;
  ext: Uint8Array;
  parse(stream: MultiBufferStream | DataStream): void;
  /** @bundle writing/avcC.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/displays/naluArrays.d.ts
declare class NALUArrays extends Array<NaluArray> {
  toString(): string;
}
//#endregion
//#region src/boxes/hvcC.d.ts
declare class hvcCBox extends Box {
  static readonly fourcc: "hvcC";
  box_name: "HEVCConfigurationBox";
  configurationVersion: number;
  general_profile_space: number;
  general_tier_flag: number;
  general_profile_idc: number;
  general_profile_compatibility: number;
  general_constraint_indicator: Uint8Array;
  general_level_idc: number;
  min_spatial_segmentation_idc: number;
  parallelismType: number;
  chroma_format_idc: number;
  bit_depth_luma_minus8: number;
  bit_depth_chroma_minus8: number;
  avgFrameRate: number;
  constantFrameRate: number;
  numTemporalLayers: number;
  temporalIdNested: number;
  lengthSizeMinusOne: number;
  nalu_arrays: NALUArrays;
  parse(stream: MultiBufferStream | DataStream): void;
  /** @bundle writing/write.js */
  write(stream: DataStream): void;
}
//#endregion
//#region src/boxes/lvcC.d.ts
declare class lvcCBox extends Box {
  static readonly fourcc: "lvcC";
  box_name: "LCEVCConfigurationBox";
  configurationVersion: number;
  LCEVCProfileIndication: number;
  LCEVCLevelIndication: number;
  chroma_format_idc: number;
  bit_depth_luma_minus8: number;
  bit_depth_chroma_minus8: number;
  lengthSizeMinusOne: number;
  pic_width_in_luma_samples: number;
  pic_height_in_luma_samples: number;
  sc_in_stream: number;
  gc_in_stream: number;
  ai_in_stream: number;
  nalu_arrays: NALUArrays;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/vpcC.d.ts
declare class vpcCBox extends FullBox {
  static readonly fourcc: "vpcC";
  box_name: "VPCodecConfigurationRecord";
  profile: number;
  level: number;
  bitDepth: number;
  chromaSubsampling: number;
  videoFullRangeFlag: number;
  colourPrimaries: number;
  transferCharacteristics: number;
  matrixCoefficients: number;
  codecIntializationDataSize: number;
  codecIntializationData: Uint8Array;
  colorSpace: number;
  transferFunction: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/vvcC.d.ts
declare class vvcCBox extends FullBox {
  static readonly fourcc: "vvcC";
  box_name: "VvcConfigurationBox";
  lengthSizeMinusOne: number;
  ptl_present_flag: number;
  ols_idx: number;
  num_sublayers: number;
  constant_frame_rate: number;
  chroma_format_idc: number;
  bit_depth_minus8: number;
  num_bytes_constraint_info: number;
  general_profile_idc: number;
  general_tier_flag: number;
  general_level_idc: number;
  ptl_frame_only_constraint_flag: number;
  ptl_multilayer_enabled_flag: number;
  general_constraint_info: Uint8Array;
  ptl_sublayer_present_mask: number;
  sublayer_level_idc: Array<number>;
  ptl_num_sub_profiles: number;
  general_sub_profile_idc: Array<number>;
  max_picture_width: number;
  max_picture_height: number;
  avg_frame_rate: number;
  nalu_arrays: Array<NaluArray>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/base.d.ts
declare class SampleEntry extends ContainerBox {
  hdr_size?: number;
  start?: number;
  static readonly registryId: unique symbol;
  data_reference_index?: number;
  constructor(size?: number, hdr_size?: number, start?: number);
  /** @bundle box-codecs.js */
  isVideo(): boolean;
  /** @bundle box-codecs.js */
  isAudio(): boolean;
  /** @bundle box-codecs.js */
  isSubtitle(): boolean;
  /** @bundle box-codecs.js */
  isMetadata(): boolean;
  /** @bundle box-codecs.js */
  isHint(): boolean;
  /** @bundle box-codecs.js */
  getCodec(): string;
  /** @bundle box-codecs.js */
  getWidth(): number;
  /** @bundle box-codecs.js */
  getHeight(): number;
  /** @bundle box-codecs.js */
  getChannelCount(): number;
  /** @bundle box-codecs.js */
  getSampleRate(): number;
  /** @bundle box-codecs.js */
  getSampleSize(): number;
  /** @bundle parsing/sampleentries/sampleentry.js */
  parseHeader(stream: MultiBufferStream): void;
  /** @bundle parsing/sampleentries/sampleentry.js */
  parse(stream: MultiBufferStream): void;
  /** @bundle parsing/sampleentries/sampleentry.js */
  parseDataAndRewind(stream: MultiBufferStream): void;
  /** @bundle parsing/sampleentries/sampleentry.js */
  parseFooter(stream: MultiBufferStream): void;
  /** @bundle writing/sampleentry.js */
  writeHeader(stream: MultiBufferStream): void;
  /** @bundle writing/sampleentry.js */
  writeFooter(stream: MultiBufferStream): void;
  /** @bundle writing/sampleentry.js */
  write(stream: MultiBufferStream): void;
}
declare class HintSampleEntry extends SampleEntry {}
declare class MetadataSampleEntry extends SampleEntry {
  /** @bundle box-codecs.js */
  isMetadata(): boolean;
}
declare class SubtitleSampleEntry extends SampleEntry {
  /** @bundle box-codecs.js */
  isSubtitle(): boolean;
}
declare class TextSampleEntry extends SampleEntry {}
declare class VisualSampleEntry extends SampleEntry {
  av1C?: av1CBox;
  avcC?: avcCBox;
  hvcC?: hvcCBox;
  lvcC?: lvcCBox;
  vpcC?: vpcCBox;
  vvcC?: vvcCBox;
  width: number;
  height: number;
  horizresolution: number;
  vertresolution: number;
  frame_count: number;
  compressorname: string;
  depth: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle box-codecs.js */
  isVideo(): boolean;
  /** @bundle box-codecs.js */
  getWidth(): number;
  /** @bundle box-codecs.js */
  getHeight(): number;
  /** @bundle writing/sampleentries/sampleentry.js */
  write(stream: MultiBufferStream): void;
}
declare class AudioSampleEntry extends SampleEntry {
  version: number;
  channel_count: number;
  samplesize: number;
  samplerate: number;
  extensions: Uint8Array;
  parse(stream: MultiBufferStream): void;
  /** @bundle box-codecs.js */
  isAudio(): boolean;
  /** @bundle box-codecs.js */
  getChannelCount(): number;
  /** @bundle box-codecs.js */
  getSampleRate(): number;
  /** @bundle box-codecs.js */
  getSampleSize(): number;
  /** @bundle writing/sampleentry.js */
  write(stream: MultiBufferStream): void;
}
declare class SystemSampleEntry extends SampleEntry {
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/sampleentry.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stsd.d.ts
declare class stsdBox extends FullBox {
  static readonly fourcc: "stsd";
  box_name: "SampleDescriptionBox";
  entries: Array<SampleEntry>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/stsd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stss.d.ts
declare class stssBox extends FullBox {
  static readonly fourcc: "stss";
  box_name: "SyncSampleBox";
  sample_numbers: Array<number>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/stss.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stsz.d.ts
declare class stszBox extends FullBox {
  static readonly fourcc: "stsz";
  box_name: "SampleSizeBox";
  sample_sizes: Array<number>;
  sample_size: number;
  sample_count: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/stsz.js */
  write(stream: MultiBufferStream): void;
  /** @bundle box-unpack.js */
  unpack(samples: any): void;
}
//#endregion
//#region src/boxes/stts.d.ts
declare class sttsBox extends FullBox {
  static readonly fourcc: "stts";
  box_name: "TimeToSampleBox";
  sample_counts: Array<number>;
  sample_deltas: Array<number>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/stts.js */
  write(stream: MultiBufferStream): void;
  /** @bundle box-unpack.js */
  unpack(samples: Array<Sample>): void;
}
//#endregion
//#region src/boxes/stz2.d.ts
declare class stz2Box extends FullBox {
  static readonly fourcc: "stz2";
  box_name: "CompactSampleSizeBox";
  sample_sizes: Array<number>;
  reserved: number;
  field_size: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/subs.d.ts
interface SampleInfo {
  size: number;
  sample_delta: number;
  subsamples: Array<SubSample>;
}
declare class subsBox extends FullBox {
  static readonly fourcc: "subs";
  box_name: "SubSampleInformationBox";
  entries: Array<SampleInfo>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tfdt.d.ts
declare class tfdtBox extends FullBox {
  static readonly fourcc: "tfdt";
  box_name: "TrackFragmentBaseMediaDecodeTimeBox";
  baseMediaDecodeTime: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/tdft.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tfhd.d.ts
declare class tfhdBox extends FullBox {
  static readonly fourcc: "tfhd";
  box_name: "TrackFragmentHeaderBox";
  track_id: number;
  base_data_offset: number;
  default_sample_description_index: number;
  default_sample_duration: number;
  default_sample_size: number;
  default_sample_flags: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/tfhd.js */
  write(stream: any): void;
}
//#endregion
//#region src/boxes/tfra.d.ts
declare class TfraEntry {
  time: number;
  moof_offset: number;
  traf_number: number;
  trun_number: number;
  sample_delta: number;
}
declare class tfraBox extends FullBox {
  static readonly fourcc: "tfra";
  box_name: "TrackFragmentRandomAccessBox";
  track_ID: number;
  length_size_of_traf_num: number;
  length_size_of_trun_num: number;
  length_size_of_sample_num: number;
  entries: Array<TfraEntry>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tkhd.d.ts
declare class tkhdBox extends FullBox {
  static readonly fourcc: "tkhd";
  box_name: "TrackHeaderBox";
  creation_time: number;
  modification_time: number;
  track_id: number;
  duration: number;
  layer: number;
  alternate_group: number;
  volume: number;
  matrix: Matrix;
  width: number;
  height: number;
  parse(stream: MultiBufferStream): void;
  write(stream: MultiBufferStream): void;
  /** @bundle box-print.js */
  print(output: {
    log: (arg: string) => void;
    indent: string;
  }): void;
}
//#endregion
//#region src/boxes/tref.d.ts
declare class trefBox extends Box {
  static readonly fourcc: "tref";
  box_name: "TrackReferenceBox";
  static allowed_types: readonly ["hint", "cdsc", "font", "hind", "vdep", "vplx", "subt", "thmb", "auxl", "cdtg", "shsc", "aest"];
  references: Array<TrackReferenceTypeBox>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/trex.d.ts
declare class trexBox extends FullBox {
  static readonly fourcc: "trex";
  box_name: "TrackExtendsBox";
  track_id: number;
  default_sample_description_index: number;
  default_sample_duration: number;
  default_sample_size: number;
  default_sample_flags: number;
  parse(stream: MultiBufferStream): void;
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/trun.d.ts
declare class trunBox extends FullBox {
  static readonly fourcc: "trun";
  box_name: "TrackRunBox";
  sample_count: number;
  data_offset: number;
  first_sample_flags: number;
  sample_duration: Array<number>;
  sample_size: Array<number>;
  sample_flags: Array<number>;
  sample_composition_time_offset: Array<number>;
  data_offset_position: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/trun.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tyco.d.ts
declare class tycoBox extends Box {
  static readonly fourcc: "tyco";
  box_name: "TypeCombinationBox";
  compatible_brands: Array<string>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dref.d.ts
declare class drefBox extends FullBox {
  static readonly fourcc: "dref";
  box_name: "DataReferenceBox";
  entries: Array<Box>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/dref.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/EntityToGroup/base.d.ts
declare class EntityToGroup extends FullBox {
  group_id: number;
  num_entities_in_group: number;
  entity_ids: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/mfhd.d.ts
declare class mfhdBox extends FullBox {
  static readonly fourcc: "mfhd";
  box_name: "MovieFragmentHeaderBox";
  sequence_number: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/mfhd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/smhd.d.ts
declare class smhdBox extends FullBox {
  static readonly fourcc: "smhd";
  box_name: "SoundMediaHeaderBox";
  balance: number;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/smhd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sthd.d.ts
declare class sthdBox extends FullBox {
  static readonly fourcc: "sthd";
  box_name: "SubtitleMediaHeaderBox";
}
//#endregion
//#region src/boxes/vmhd.d.ts
declare class vmhdBox extends FullBox {
  static readonly fourcc: "vmhd";
  box_name: "VideoMediaHeaderBox";
  graphicsmode: number;
  opcolor: Uint16Array | [number, number, number];
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/vmhd.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/ispe.d.ts
declare class ispeBox extends FullBox {
  static readonly fourcc: "ispe";
  box_name: "ImageSpatialExtentsProperty";
  image_width: number;
  image_height: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/clap.d.ts
declare class clapBox extends Box {
  static readonly fourcc: "clap";
  box_name: "CleanApertureBox";
  cleanApertureWidthN: number;
  cleanApertureWidthD: number;
  cleanApertureHeightN: number;
  cleanApertureHeightD: number;
  horizOffN: number;
  horizOffD: number;
  vertOffN: number;
  vertOffD: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/irot.d.ts
declare class irotBox extends Box {
  static readonly fourcc: "irot";
  box_name: "ImageRotation";
  angle: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/maxr.d.ts
declare class maxrBox extends Box {
  static readonly fourcc: "maxr";
  box_name: "hintmaxrate";
  period: number;
  bytes: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/defaults.d.ts
/**********************************************************************************/
/**********************************************************************************/
declare class mdatBox extends Box {
  static readonly fourcc: "mdat";
  box_name: "MediaDataBox";
  stream?: MultiBufferStream;
}
declare class idatBox extends Box {
  static readonly fourcc: "idat";
  box_name: "ItemDataBox";
}
declare class freeBox extends Box {
  static readonly fourcc: "free";
  box_name: "FreeSpaceBox";
}
declare class skipBox extends Box {
  static readonly fourcc: "skip";
  box_name: "FreeSpaceBox";
}
/**********************************************************************************/
/**********************************************************************************/
declare class hmhdBox extends FullBox {
  static readonly fourcc: "hmhd";
  box_name: "HintMediaHeaderBox";
}
declare class nmhdBox extends FullBox {
  static readonly fourcc: "nmhd";
  box_name: "NullMediaHeaderBox";
}
declare class iodsBox extends FullBox {
  static readonly fourcc: "iods";
  box_name: "ObjectDescriptorBox";
}
declare class xmlBox extends FullBox {
  static readonly fourcc: "xml ";
  box_name: "XMLBox";
}
declare class bxmlBox extends FullBox {
  static readonly fourcc: "bxml";
  box_name: "BinaryXMLBox";
}
declare class iproBox extends FullBox {
  static readonly fourcc: "ipro";
  box_name: "ItemProtectionBox";
  sinfs: Array<sinfBox>;
  get protections(): sinfBox[];
}
/**********************************************************************************/
/**********************************************************************************/
declare class moovBox extends ContainerBox {
  static readonly fourcc: "moov";
  box_name: "MovieBox";
  timescale: number;
  mvhd: mvhdBox;
  mvhds: Array<mvhdBox>;
  mvex?: mvexBox;
  mvexs: Array<mvexBox>;
  iods: iodsBox;
  iodss: Array<iodsBox>;
  trak: trakBox;
  traks: Array<trakBox>;
  psshs: Array<psshBox>;
  subBoxNames: readonly ["trak", "pssh"];
}
declare class trakBox extends ContainerBox {
  static readonly fourcc: "trak";
  box_name: "TrackBox";
  mdia: mdiaBox;
  mdias: Array<mdiaBox>;
  tkhd: tkhdBox;
  tkhds: Array<tkhdBox>;
  tref: trefBox;
  trefs: Array<trefBox>;
  edts?: edtsBox;
  edtss: Array<edtsBox>;
  udta: udtaBox;
  udtas: Array<udtaBox>;
  samples_duration: number;
  samples: Array<Sample>;
  samples_size: number;
  nextSample: number;
  lastValidSample: number;
  sample_groups_info: Array<SampleGroupInfo>;
  first_dts: number;
  first_traf_merged: boolean;
  has_fragment_subsamples: boolean;
}
declare class edtsBox extends ContainerBox {
  static readonly fourcc: "edts";
  box_name: "EditBox";
  elst?: elstBox;
  elsts: Array<elstBox>;
}
declare class mdiaBox extends ContainerBox {
  static readonly fourcc: "mdia";
  box_name: "MediaBox";
  elng: elngBox;
  elngs: Array<elngBox>;
  hdlr: hdlrBox;
  hdlrs: Array<hdlrBox>;
  mdhd: mdhdBox;
  mdhds: Array<mdhdBox>;
  minf: minfBox;
  minfs: Array<minfBox>;
}
declare class minfBox extends ContainerBox {
  static readonly fourcc: "minf";
  box_name: "MediaInformationBox";
  stbl: stblBox;
  stbls: Array<stblBox>;
  hmhd: hmhdBox;
  hmhds: Array<hmhdBox>;
  vmhd?: vmhdBox;
  vmhds?: Array<vmhdBox>;
  smhd?: smhdBox;
  smhds?: Array<smhdBox>;
  sthd?: sthdBox;
  sthds?: Array<sthdBox>;
  nmhd?: nmhdBox;
  nmhds?: Array<nmhdBox>;
  dinf: dinfBox;
  dinfs: Array<dinfBox>;
  dref: drefBox;
  drefs: Array<drefBox>;
}
declare class dinfBox extends ContainerBox {
  static readonly fourcc: "dinf";
  box_name: "DataInformationBox";
}
declare class stblBox extends ContainerBox {
  static readonly fourcc: "stbl";
  box_name: "SampleTableBox";
  cslg: cslgBox;
  cslgs: Array<cslgBox>;
  stsd: stsdBox;
  stsds: Array<stsdBox>;
  stsc: stscBox;
  stscs: Array<stscBox>;
  stco: stcoBox;
  stcos: Array<stcoBox>;
  co64: co64Box;
  co64s: Array<co64Box>;
  stsz: stszBox;
  stszs: Array<stszBox>;
  stz2: stz2Box;
  stz2s: Array<stz2Box>;
  stts: sttsBox;
  sttss: Array<sttsBox>;
  ctts: cttsBox;
  cttss: Array<cttsBox>;
  stss: stssBox;
  stsss: Array<stssBox>;
  subs: subsBox;
  subss: Array<subsBox>;
  stdp: stdpBox;
  stdps: Array<stdpBox>;
  sdtp: sdtpBox;
  sdtps: Array<sdtpBox>;
  sgpds: Array<sgpdBox>;
  sbgps: Array<sbgpBox>;
  subBoxNames: string[];
}
declare class mvexBox extends ContainerBox {
  static readonly fourcc: "mvex";
  box_name: "MovieExtendsBox";
  trex: trexBox;
  mehd?: mehdBox;
  mehds: Array<mehdBox>;
  trexs: Array<trexBox>;
  subBoxNames: string[];
}
declare class moofBox extends ContainerBox {
  static readonly fourcc: "moof";
  box_name: "MovieFragmentBox";
  mfhd: mfhdBox;
  mfhds: Array<mfhdBox>;
  traf: trafBox;
  trafs: Array<trafBox>;
  subBoxNames: string[];
}
declare class trafBox extends ContainerBox {
  static readonly fourcc: "traf";
  box_name: "TrackFragmentBox";
  subs: subsBox;
  subss: Array<subsBox>;
  tfdt: tfdtBox;
  tfdts: Array<tfdtBox>;
  tfhd: tfhdBox;
  tfhds: Array<tfhdBox>;
  trun: trunBox;
  first_sample_index: number;
  sample_number: number;
  sample_groups_info: Array<SampleGroupInfo>;
  truns: Array<trunBox>;
  sgpds: Array<sgpdBox>;
  sbgps: Array<sbgpBox>;
  subBoxNames: string[];
}
declare class vttcBox extends ContainerBox {
  static readonly fourcc: "vttc";
  box_name: "VTTCueBox";
}
declare class mfraBox extends ContainerBox {
  static readonly fourcc: "mfra";
  box_name: "MovieFragmentRandomAccessBox";
  tfras: Array<tfraBox>;
  subBoxNames: readonly ["tfra"];
}
declare class mecoBox extends ContainerBox {
  static readonly fourcc: "meco";
  box_name: "AdditionalMetadataContainerBox";
}
declare class hntiBox extends ContainerBox {
  static readonly fourcc: "hnti";
  box_name: "trackhintinformation";
  subBoxNames: readonly ["sdp ", "rtp "];
}
declare class hinfBox extends ContainerBox {
  static readonly fourcc: "hinf";
  box_name: "hintstatisticsbox";
  maxrs: Array<maxrBox>;
  subBoxNames: readonly ["maxr"];
}
declare class strkBox extends ContainerBox {
  static readonly fourcc: "strk";
  box_name: "SubTrackBox";
}
declare class strdBox extends ContainerBox {
  static readonly fourcc: "strd";
  box_name: "SubTrackDefinitionBox";
}
declare class sinfBox extends ContainerBox {
  static readonly fourcc: "sinf";
  box_name: "ProtectionSchemeInfoBox";
}
declare class rinfBox extends ContainerBox {
  static readonly fourcc: "rinf";
  box_name: "RestrictedSchemeInfoBox";
}
declare class schiBox extends ContainerBox {
  static readonly fourcc: "schi";
  box_name: "SchemeInformationBox";
}
declare class trgrBox extends ContainerBox {
  static readonly fourcc: "trgr";
  box_name: "TrackGroupBox";
}
declare class udtaBox extends ContainerBox {
  static readonly fourcc: "udta";
  box_name: "UserDataBox";
  kinds: Array<kindBox>;
  strks: Array<strkBox>;
  subBoxNames: readonly ["kind", "strk"];
}
declare class iprpBox extends ContainerBox {
  static readonly fourcc: "iprp";
  box_name: "ItemPropertiesBox";
  ipco: ipcoBox;
  ipmas: Array<ipmaBox>;
  subBoxNames: readonly ["ipma"];
}
declare class ipcoBox extends ContainerBox {
  static readonly fourcc: "ipco";
  box_name: "ItemPropertyContainerBox";
  hvcCs: Array<hvcCBox>;
  ispes: Array<ispeBox>;
  claps: Array<clapBox>;
  irots: Array<irotBox>;
  subBoxNames: readonly ["hvcC", "ispe", "clap", "irot"];
}
declare class grplBox extends ContainerBox {
  static readonly fourcc: "grpl";
  box_name: "GroupsListBox";
  boxes: Array<EntityToGroup>;
}
declare class j2kHBox extends ContainerBox {
  static readonly fourcc: "j2kH";
  box_name: "J2KHeaderInfoBox";
}
declare class etypBox extends ContainerBox {
  static readonly fourcc: "etyp";
  box_name: "ExtendedTypeBox";
  tycos: Array<tycoBox>;
  subBoxNames: readonly ["tyco"];
}
declare class povdBox extends ContainerBox {
  static readonly fourcc: "povd";
  box_name: "ProjectedOmniVideoBox";
  subBoxNames: readonly ["prfr"];
}
//#endregion
//#region src/boxes/ftyp.d.ts
declare class ftypBox extends Box {
  static readonly fourcc: "ftyp";
  box_name: "FileTypeBox";
  major_brand: string;
  minor_version: number | string;
  compatible_brands: Array<string>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/ftyp.js */
  write(stream: MultiBufferStream | DataStream): void;
}
//#endregion
//#region src/boxes/infe.d.ts
declare class infeBox extends FullBox {
  static readonly fourcc: "infe";
  box_name: "ItemInfoEntry";
  item_ID: number;
  item_protection_index: number;
  item_name: string;
  content_type: string;
  content_encoding: string;
  extension_type: string;
  item_type: string;
  item_uri_type: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/iinf.d.ts
declare class iinfBox extends FullBox {
  static readonly fourcc: "iinf";
  box_name: "ItemInfoBox";
  version: number;
  entry_count: number;
  item_infos: Array<infeBox>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/iloc.d.ts
interface Extent {
  extent_index: number;
  extent_offset: number;
  extent_length: number;
}
declare class ilocBox extends FullBox {
  static readonly fourcc: "iloc";
  box_name: "ItemLocationBox";
  offset_size: number;
  length_size: number;
  base_offset_size: number;
  index_size: number;
  items: Array<{
    base_offset: number;
    construction_method: number;
    item_ID: number;
    data_reference_index: number;
    extents: Array<Extent>;
  }>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/iref.d.ts
declare class irefBox extends FullBox {
  static readonly fourcc: "iref";
  box_name: "ItemReferenceBox";
  static allowed_types: readonly ["auxl", "base", "cdsc", "dimg", "dpnd", "eroi", "evir", "exbl", "fdl ", "font", "iloc", "mask", "mint", "pred", "prem", "tbas", "text", "thmb"];
  references: Array<SingleItemTypeReferenceBox | SingleItemTypeReferenceBoxLarge>;
  version: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/pitm.d.ts
declare class pitmBox extends FullBox {
  static readonly fourcc: "pitm";
  box_name: "PrimaryItemBox";
  item_id: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/meta.d.ts
declare class metaBox extends FullBox {
  static readonly fourcc: "meta";
  box_name: "MetaBox";
  isQT: boolean;
  hdlr: hdlrBox;
  hdlrs: Array<hdlrBox>;
  iinf: iinfBox;
  iinfs: Array<iinfBox>;
  idat: idatBox;
  idats: Array<idatBox>;
  ipro: iproBox;
  ipros: Array<iproBox>;
  grpl: grplBox;
  grpls: Array<grplBox>;
  iloc: ilocBox;
  ilocs: Array<ilocBox>;
  iprp: iprpBox;
  iprps: Array<iprpBox>;
  pitm: pitmBox;
  pitms: Array<pitmBox>;
  iref: irefBox;
  irefs: Array<irefBox>;
  dinf: dinfBox;
  dinfs: Array<dinfBox>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sidx.d.ts
interface Reference$1 {
  reference_type: number;
  referenced_size: number;
  subsegment_duration: number;
  starts_with_SAP: number;
  SAP_type: number;
  SAP_delta_time: number;
}
declare class sidxBox extends FullBox {
  static readonly fourcc: "sidx";
  box_name: "CompressedSegmentIndexBox";
  reference_ID: number;
  timescale: number;
  earliest_presentation_time: number;
  first_offset: number;
  references: Array<Reference$1>;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/sidx.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/parser.d.ts
declare function parseOneBox(stream: MultiBufferStream, headerOnly: boolean, parentSize?: number): IncompleteBox;
//#endregion
//#region src/isofile.d.ts
declare class SampleGroupInfo {
  grouping_type: string;
  grouping_type_parameter: number;
  sbgp?: sbgpBox;
  last_sample_in_run: number;
  entry_index: number;
  description: Description;
  fragment_description: Description;
  is_fragment: boolean;
  constructor(grouping_type: string, grouping_type_parameter: number, sbgp?: sbgpBox);
}
interface IsoFileOptions {
  brands?: Array<string>;
  description_boxes?: Array<BoxKind>;
  duration?: number;
  height?: number;
  id?: number;
  language?: string;
  layer?: number;
  media_duration?: number;
  rate?: number;
  timescale?: number;
  type?: SampleEntryFourCC;
  width?: number;
  hdlr?: string;
  name?: string;
  hevcDecoderConfigRecord?: ArrayBuffer;
  avcDecoderConfigRecord?: ArrayBuffer;
  balance?: number;
  channel_count?: number;
  samplesize?: number;
  samplerate?: number;
  namespace?: string;
  schema_location?: string;
  auxiliary_mime_types?: string;
  description?: Box;
  default_sample_description_index?: number;
  default_sample_duration?: number;
  default_sample_size?: number;
  default_sample_flags?: number;
}
declare class ISOFile<TSegmentUser = unknown, TSampleUser = unknown> {
  /** MutiBufferStream object used to parse boxes */
  stream: MultiBufferStream;
  /** Array of all boxes (in order) found in the file */
  boxes: Array<Box>;
  /** Array of all mdats */
  mdats: Array<mdatBox>;
  /** Array of all moofs */
  moofs: Array<moofBox>;
  /** Boolean indicating if the file is compatible with progressive parsing (moov first) */
  isProgressive: boolean;
  /** Boolean used to fire moov start event only once */
  moovStartFound: boolean;
  /** Callback called when the moov parsing starts */
  onMoovStart?: () => void;
  /** Boolean keeping track of the call to onMoovStart, to avoid double calls */
  moovStartSent: boolean;
  /** Callback called when the moov is entirely parsed */
  onReady?: (info: Movie) => void;
  /** Boolean keeping track of the call to onReady, to avoid double calls */
  readySent: boolean;
  /** Callback to call when segments are ready */
  onSegment?: (id: number, user: TSegmentUser, buffer: ArrayBuffer, nextSample: number, last: boolean) => void;
  /** Callback to call when samples are ready */
  onSamples?: (id: number, user: TSampleUser, samples: Array<Sample>) => void;
  /** Callback to call when there is an error in the parsing or processing of samples */
  onError?: (module: string, message: string) => void;
  /** Callback to call when an item is processed */
  onItem?: () => void;
  /** Boolean indicating if the moov box run-length encoded tables of sample information have been processed */
  sampleListBuilt: boolean;
  /** Array of Track objects for which fragmentation of samples is requested */
  fragmentedTracks: Array<FragmentedTrack<TSegmentUser>>;
  /** Array of Track objects for which extraction of samples is requested */
  extractedTracks: Array<ExtractedTrack<TSampleUser>>;
  /** Boolean indicating that fragmention is ready */
  isFragmentationInitialized: boolean;
  /** Boolean indicating that fragmented has started */
  sampleProcessingStarted: boolean;
  /** Number of the next 'moof' to generate when fragmenting */
  nextMoofNumber: number;
  /** Boolean indicating if the initial list of items has been produced */
  itemListBuilt: boolean;
  /** Callback called when the sidx box is entirely parsed */
  onSidx?: (sidx: sidxBox) => void;
  /** Boolean keeping track of the call to onSidx, to avoid double calls */
  sidxSent: boolean;
  /** @bundle isofile-item-processing.js */
  items: Array<Item>;
  /** @bundle isofile-item-processing.js */
  entity_groups: Array<EntityGroup>;
  /**
   * size of the buffers allocated for samples
   * @bundle isofile-item-processing.js
   */
  itemsDataSize: number;
  moov: moovBox;
  moovs: Array<moovBox>;
  sidx: sidxBox;
  sidxs: Array<sidxBox>;
  meta: metaBox;
  metas: Array<metaBox>;
  ftyp: ftypBox;
  ftyps: Array<ftypBox>;
  nextSeekPosition: number;
  initial_duration: number;
  constructor(stream?: MultiBufferStream, discardMdatData?: boolean);
  setSegmentOptions(id: number, user: TSegmentUser, opts: Partial<{
    nbSamples: number;
    nbSamplesPerFragment: number;
    sizePerSegment: number;
    rapAlignement: boolean;
    normalizeAudioSampleEntriesForMSE: boolean;
  }>): void;
  unsetSegmentOptions(id: number): void;
  setExtractionOptions(id: number, user?: TSampleUser, {
    nbSamples: nb_samples
  }?: {
    nbSamples?: number;
  }): void;
  unsetExtractionOptions(id: number): void;
  parse(): void;
  checkBuffer(ab?: MP4BoxBuffer): boolean;
  /**
   * Processes a new ArrayBuffer (with a fileStart property)
   * Returns the next expected file position, or undefined if not ready to parse
   */
  appendBuffer(ab: MP4BoxBuffer, last?: boolean): number;
  getFragmentDuration(): {
    num: number;
    den: number;
  };
  getInfo(): Movie;
  setNextSeekPositionFromSample(sample: Sample): void;
  processSamples(last?: boolean): void;
  getBox<T extends AllIdentifiers>(type: T): AllRegisteredBoxes[T] | undefined;
  getBoxes<T extends AllIdentifiers>(type: T, returnEarly: boolean): AllRegisteredBoxes[T][];
  getTrackSamplesInfo(track_id: number): Sample[];
  getTrackSample(track_id: number, number: number): Sample;
  releaseUsedSamples(id: number, sampleNum: number): void;
  start(): void;
  stop(): void;
  flush(): void;
  seekTrack(time: number, useRap: boolean, trak: trakBox): {
    offset: number;
    time: number;
  };
  resetFragmentedTrackStateAfterSeek(trak: trakBox, seekSampleNumber: number): void;
  resetExtractedTrackStateAfterSeek(trak: trakBox): void;
  getTrackDuration(trak: trakBox): number;
  seek(time: number, useRap: boolean): {
    offset: number;
    time: number;
  };
  equal(b: {
    boxes: Array<Box>;
  }): boolean;
  /**
   * Rewrite the entire file
   * @bundle isofile-write.js
   */
  write(outstream: DataStream): void;
  /** @bundle isofile-write.js */
  createFragment(track_id: number, sampleStart: number, sampleEnd: number, existingStream: DataStream): DataStream;
  /**
   * Modify the file and create the initialization segment
   * @bundle isofile-write.js
   */
  static writeInitializationSegment(ftyp: ftypBox, moov: moovBox, total_duration: number, normalizeAudioSampleEntryTrackIds?: Set<number>): MP4BoxBuffer;
  /** @bundle isofile-write.js */
  save(name: string): Blob;
  /** @bundle isofile-write.js */
  getBuffer(): DataStream;
  /** @bundle isofile-write.js */
  private static normalizeAudioSampleEntriesForMSEFragmentedInit;
  /** @bundle isofile-write.js */
  initializeSegmentation(mode?: 'combined'): SegmentationInitialization<TSegmentUser>;
  initializeSegmentation(mode: 'per-track'): Array<SegmentationInitializationPerTrack<TSegmentUser>>;
  /**
   * Index of the last moof box received
   * @bundle isofile-sample-processing.js
   */
  lastMoofIndex: number;
  /**
   * size of the buffers allocated for samples
   * @bundle isofile-sample-processing.js
   */
  samplesDataSize: number;
  /**
   * Resets all sample tables
   * @bundle isofile-sample-processing.js
   */
  resetTables(): void;
  /** @bundle isofile-sample-processing.js */
  static initSampleGroups(trak: trakBox, traf: trafBox | undefined, sbgps: Array<sbgpBox>, trak_sgpds: Array<sgpdBox>, traf_sgpds?: Array<sgpdBox>): void;
  /** @bundle isofile-sample-processing.js */
  static setSampleGroupProperties(trak: trakBox, sample: Sample, sample_number: number, sample_groups_info: Array<SampleGroupInfo>): void;
  /** @bundle isofile-sample-processing.js */
  static process_sdtp(sdtp: sdtpBox, sample: Sample, number: number): void;
  buildSampleLists(): void;
  buildTrakSampleLists(trak: trakBox): void;
  /**
   * Update sample list when new 'moof' boxes are received
   * @bundle isofile-sample-processing.js
   */
  updateSampleLists(): void;
  /**
   * Try to get sample data for a given sample:
   * returns null if not found
   * returns the same sample if already requested
   *
   * @bundle isofile-sample-processing.js
   */
  getSample(trak: trakBox, sampleNum: number): Sample;
  /**
   * Release the memory used to store the data of the sample
   *
   * @bundle isofile-sample-processing.js
   */
  releaseSample(trak: trakBox, sampleNum: number): number;
  /** @bundle isofile-sample-processing.js */
  getAllocatedSampleDataSize(): number;
  /**
   * Builds the MIME Type 'codecs' sub-parameters for the whole file
   *
   * @bundle isofile-sample-processing.js
   */
  getCodecs(): string;
  /**
   * Helper function
   *
   * @bundle isofile-sample-processing.js
   */
  getTrexById(id: number): trexBox;
  /**
   * Helper function
   *
   * @bundle isofile-sample-processing.js
   */
  getTrackById(id: number): trakBox;
  /** @bundle isofile-item-processing.js */
  flattenItemInfo(): void;
  /** @bundle isofile-item-processing.js */
  getItem(item_id: number): Item;
  /**
   * Release the memory used to store the data of the item
   *
   * @bundle isofile-item-processing.js
   */
  releaseItem(item_id: number): number;
  /** @bundle isofile-item-processing.js */
  processItems(callback: (item: Item) => void): void;
  /** @bundle isofile-item-processing.js */
  hasItem(name: string): number;
  /** @bundle isofile-item-processing.js */
  getMetaHandler(): string;
  /** @bundle isofile-item-processing.js */
  getPrimaryItem(): Item;
  /** @bundle isofile-item-processing.js */
  itemToFragmentedTrackFile({
    itemId
  }?: {
    itemId?: number;
  }): ISOFile<unknown, unknown>;
  /**
   * position in the current buffer of the beginning of the last box parsed
   *
   * @bundle isofile-advanced-parsing.js
   */
  lastBoxStartPosition: number;
  /**
   * indicator if the parsing is stuck in the middle of an mdat box
   *
   * @bundle isofile-advanced-parsing.js
   */
  parsingMdat?: mdatBox;
  nextParsePosition: number;
  /**
   * keep mdat data
   *
   * @bundle isofile-advanced-parsing.js
   */
  discardMdatData: boolean;
  /** @bundle isofile-advanced-parsing.js */
  processIncompleteBox(ret: IncompleteBox): boolean;
  /** @bundle isofile-advanced-parsing.js */
  hasIncompleteMdat(): boolean;
  /**
   * Transfer the data of the mdat box to its stream
   * @param mdat the mdat box to use
   */
  transferMdatData(inMdat?: mdatBox): void;
  /** @bundle isofile-advanced-parsing.js */
  processIncompleteMdat(): boolean;
  /** @bundle isofile-advanced-parsing.js */
  restoreParsePosition(): boolean;
  /** @bundle isofile-advanced-parsing.js */
  saveParsePosition(): void;
  /** @bundle isofile-advanced-parsing.js */
  updateUsedBytes(box: Box, _ret: ReturnType<typeof parseOneBox>): void;
  /** @bundle isofile-advanced-creation.js */
  addBox<T extends Box>(box: T): T;
  /** @bundle isofile-advanced-creation.js */
  init(options?: IsoFileOptions): this;
  /** @bundle isofile-advanced-creation.js */
  addTrack(_options?: IsoFileOptions): number;
  /** @bundle isofile-advanced-creation.js */
  addSample(track_id: number, data: Uint8Array<ArrayBuffer>, {
    sample_description_index,
    duration,
    cts,
    dts,
    is_sync,
    is_leading,
    depends_on,
    is_depended_on,
    has_redundancy,
    degradation_priority,
    subsamples,
    offset
  }?: {
    sample_description_index?: number;
    duration?: number;
    cts?: number;
    dts?: number;
    is_sync?: boolean;
    is_leading?: number;
    depends_on?: number;
    is_depended_on?: number;
    has_redundancy?: number;
    degradation_priority?: number;
    subsamples?: Array<SubSample>;
    offset?: number;
  }): Sample;
  /** @bundle isofile-advanced-creation.js */
  createMoof(samples: Array<Sample>): moofBox;
  /** @bundle box-print.js */
  print(output: Output): void;
}
//#endregion
//#region src/DataStream.d.ts
type ReadTypeReturnValue = string | number | Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | Array<ReadTypeReturnValue> | {
  [key: string]: ReadTypeReturnValue;
};
declare enum Endianness {
  BIG_ENDIAN = 1,
  LITTLE_ENDIAN = 2
}
declare class DataStream {
  #private;
  static ENDIANNESS: Endianness;
  isofile?: ISOFile;
  _buffer?: MP4BoxBuffer;
  _byteOffset?: number;
  _dataView?: DataView<ArrayBuffer>;
  endianness: Endianness;
  protected position: number;
  /**
   * DataStream reads scalars, arrays and structs of data from an ArrayBuffer.
   * It's like a file-like DataView on steroids.
   *
   * @param arrayBuffer ArrayBuffer to read from.
   * @param byteOffset Offset from arrayBuffer beginning for the DataStream.
   * @param endianness Endianness of the DataStream (default: BIG_ENDIAN).
   */
  constructor(arrayBuffer?: ArrayBuffer | DataView<ArrayBuffer> | number, byteOffset?: number, endianness?: Endianness);
  getPosition(): number;
  /**
   * Internal function to resize the DataStream buffer when required.
   * @param extra Number of bytes to add to the buffer allocation.
   */
  _realloc(extra: number): void;
  /**
   * Internal function to trim the DataStream buffer when required.
   * Used for stripping out the extra bytes from the backing buffer when
   * the virtual byteLength is smaller than the buffer byteLength (happens after
   * growing the buffer with writes and not filling the extra space completely).
   */
  _trimAlloc(): void;
  /**
   * Virtual byte length of the DataStream backing buffer.
   * Updated to be max of original buffer size and last written size.
   * If dynamicSize is false is set to buffer size.
   */
  _byteLength: number;
  /**
   * Returns the byte length of the DataStream object.
   * @type {number}
   */
  get byteLength(): number;
  /**
   * Set/get the backing ArrayBuffer of the DataStream object.
   * The setter updates the DataView to point to the new buffer.
   * @type {Object}
   */
  get buffer(): MP4BoxBuffer;
  set buffer(value: MP4BoxBuffer);
  /**
   * Set/get the byteOffset of the DataStream object.
   * The setter updates the DataView to point to the new byteOffset.
   * @type {number}
   */
  get byteOffset(): number;
  set byteOffset(value: number);
  /**
   * Set/get the byteOffset of the DataStream object.
   * The setter updates the DataView to point to the new byteOffset.
   * @type {number}
   */
  get dataView(): DataView<ArrayBuffer>;
  set dataView(value: DataView<ArrayBuffer>);
  /**
   *   Sets the DataStream read/write position to given position.
   *   Clamps between 0 and DataStream length.
   *
   *   @param pos Position to seek to.
   *   @return
   */
  seek(pos: number): void;
  /**
   * Returns true if the DataStream seek pointer is at the end of buffer and
   * there's no more data to read.
   *
   * @return True if the seek pointer is at the end of the buffer.
   */
  isEof(): boolean;
  /**
   * Maps a Uint8Array into the DataStream buffer.
   *
   * Nice for quickly reading in data.
   *
   * @param length Number of elements to map.
   * @param e Endianness of the data to read.
   * @return Uint8Array to the DataStream backing buffer.
   */
  mapUint8Array(length: number): Uint8Array<MP4BoxBuffer>;
  /**
   * Reads an Int32Array of desired length and endianness from the DataStream.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return The read Int32Array.
   */
  readInt32Array(length?: number, endianness?: Endianness): Int32Array<ArrayBuffer>;
  /**
   * Reads an Int16Array of desired length and endianness from the DataStream.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return The read Int16Array.
   */
  readInt16Array(length?: number, endianness?: Endianness): Int16Array<ArrayBuffer>;
  /**
   * Reads an Int8Array of desired length from the DataStream.
   *
   * @param length Number of elements to map.
   * @param e Endianness of the data to read.
   * @return The read Int8Array.
   */
  readInt8Array(length?: number): Int8Array<ArrayBuffer>;
  /**
   * Reads a Uint32Array of desired length and endianness from the DataStream.
   *
   *  @param length Number of elements to map.
   *  @param endianness Endianness of the data to read.
   *  @return The read Uint32Array.
   */
  readUint32Array(length?: number, endianness?: Endianness): Uint32Array<ArrayBuffer>;
  /**
   * Reads a Uint16Array of desired length and endianness from the DataStream.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return The read Uint16Array.
   */
  readUint16Array(length?: number, endianness?: Endianness): Uint16Array<ArrayBuffer>;
  /**
   * Reads a Uint8Array of desired length from the DataStream.
   *
   * @param length Number of elements to map.
   * @param e Endianness of the data to read.
   * @return The read Uint8Array.
   */
  readUint8Array(length?: number): Uint8Array<ArrayBuffer>;
  /**
   * Reads a Float64Array of desired length and endianness from the DataStream.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return The read Float64Array.
   */
  readFloat64Array(length?: number, endianness?: Endianness): Float64Array<ArrayBuffer>;
  /**
   * Reads a Float32Array of desired length and endianness from the DataStream.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return The read Float32Array.
   */
  readFloat32Array(length?: number, endianness?: Endianness): Float32Array<ArrayBuffer>;
  /**
   * Reads a 32-bit int from the DataStream with the desired endianness.
   *
   * @param endianness Endianness of the number.
   * @return The read number.
   */
  readInt32(endianness?: Endianness): number;
  /**
   * Reads a 16-bit int from the DataStream with the desired endianness.
   *
   * @param endianness Endianness of the number.
   * @return The read number.
   */
  readInt16(endianness?: Endianness): number;
  /**
   * Reads an 8-bit int from the DataStream.
   *
   * @return The read number.
   */
  readInt8(): number;
  /**
   * Reads a 32-bit unsigned int from the DataStream with the desired endianness.
   *
   * @param endianness Endianness of the number.
   * @return The read number.
   */
  readUint32(endianness?: Endianness): number;
  /**
   * Reads a 16-bit unsigned int from the DataStream with the desired endianness.
   *
   * @param endianness Endianness of the number.
   * @return The read number.
   */
  readUint16(endianness?: Endianness): number;
  /**
   * Reads an 8-bit unsigned int from the DataStream.
   *
   * @return The read number.
   */
  readUint8(): number;
  /**
   * Reads a 32-bit float from the DataStream with the desired endianness.
   *
   * @param endianness Endianness of the number.
   * @return The read number.
   */
  readFloat32(endianness?: Endianness): number;
  /**
   * Reads a 64-bit float from the DataStream with the desired endianness.
   *
   * @param endianness Endianness of the number.
   * @return The read number.
   */
  readFloat64(endianness?: Endianness): number;
  /**
   * Copies byteLength bytes from the src buffer at srcOffset to the
   * dst buffer at dstOffset.
   *
   * @param dst Destination ArrayBuffer to write to.
   * @param dstOffset Offset to the destination ArrayBuffer.
   * @param src Source ArrayBuffer to read from.
   * @param srcOffset Offset to the source ArrayBuffer.
   * @param byteLength Number of bytes to copy.
   */
  static memcpy(dst: ArrayBufferLike, dstOffset?: number, src?: ArrayBufferLike, srcOffset?: number, byteLength?: number): void;
  /**
   * Converts array to native endianness in-place.
   *
   * @param typedArray Typed array to convert.
   * @param endianness True if the data in the array is
   *                                      little-endian. Set false for big-endian.
   * @return The converted typed array.
   */
  static arrayToNative(typedArray: TypedArray, endianness?: Endianness): TypedArray;
  /**
   * Converts native endianness array to desired endianness in-place.
   *
   * @param typedArray Typed array to convert.
   * @param littleEndian True if the converted array should be
   *                               little-endian. Set false for big-endian.
   * @return The converted typed array.
   */
  static nativeToEndian(typedArray: TypedArray, littleEndian: boolean): TypedArray;
  /**
   * Flips typed array endianness in-place.
   *
   * @param typedArray Typed array to flip.
   * @return The converted typed array.
   */
  static flipArrayEndianness(typedArray: TypedArray): TypedArray;
  /**
   * Seek position where DataStream#readStruct ran into a problem.
   * Useful for debugging struct parsing.
   *
   * @type {number}
   */
  failurePosition: number;
  /**
   * Read a string of desired length and encoding from the DataStream.
   *
   * @param length The length of the string to read in bytes.
   * @param encoding The encoding of the string data in the DataStream.
   *                           Defaults to ASCII.
   * @return The read string.
   */
  readString(length: number, encoding?: Charset): string;
  /**
   * Read null-terminated string of desired length from the DataStream. Truncates
   * the returned string so that the null byte is not a part of it.
   *
   * @param length The length of the string to read.
   * @return The read string.
   */
  readCString(length?: number): string;
  readInt64(): number;
  readUint64(): number;
  readUint24(): number;
  /**
   * Saves the DataStream contents to the given filename.
   * Uses Chrome's anchor download property to initiate download.
   *
   * @param filename Filename to save as.
   * @return
   * @bundle DataStream-write.js
   */
  save(filename: string): Blob;
  /**
   * Whether to extend DataStream buffer when trying to write beyond its size.
   * If set, the buffer is reallocated to twice its current size until the
   * requested write fits the buffer.
   *
   * @type {boolean}
   * @bundle DataStream-write.js
   */
  _dynamicSize: number;
  /** @bundle DataStream-write.js */
  get dynamicSize(): number;
  /** @bundle DataStream-write.js */
  set dynamicSize(v: number);
  /**
   * Internal function to trim the DataStream buffer when required.
   * Used for stripping out the first bytes when not needed anymore.
   *
   * @return
   * @bundle DataStream-write.js
   */
  shift(offset: number): void;
  /**
   * Writes an Int32Array of specified endianness to the DataStream.
   *
   * @param array The array to write.
   * @param endianness Endianness of the data to write.
   * @bundle DataStream-write.js
   */
  writeInt32Array(array: ArrayLike<number>, endianness?: Endianness): void;
  /**
   * Writes an Int16Array of specified endianness to the DataStream.
   *
   * @param array The array to write.
   * @param endianness Endianness of the data to write.
   * @bundle DataStream-write.js
   */
  writeInt16Array(array: ArrayLike<number>, endianness?: Endianness): void;
  /**
   * Writes an Int8Array to the DataStream.
   *
   * @param array The array to write.
   * @bundle DataStream-write.js
   */
  writeInt8Array(array: ArrayLike<number>): void;
  /**
   * Writes a Uint32Array of specified endianness to the DataStream.
   *
   * @param array The array to write.
   * @param endianness Endianness of the data to write.
   * @bundle DataStream-write.js
   */
  writeUint32Array(array: ArrayLike<number>, endianness?: Endianness): void;
  /**
   * Writes a Uint16Array of specified endianness to the DataStream.
   *
   * @param array The array to write.
   * @param endianness Endianness of the data to write.
   * @bundle DataStream-write.js
   */
  writeUint16Array(array: ArrayLike<number>, endianness?: Endianness): void;
  /**
   * Writes a Uint8Array to the DataStream.
   *
   * @param array The array to write.
   * @bundle DataStream-write.js
   */
  writeUint8Array(array: ArrayLike<number>): void;
  /**
   * Writes a Float64Array of specified endianness to the DataStream.
   *
   * @param array The array to write.
   * @param endianness Endianness of the data to write.
   * @bundle DataStream-write.js
   */
  writeFloat64Array(array: ArrayLike<number>, endianness?: Endianness): void;
  /**
   * Writes a Float32Array of specified endianness to the DataStream.
   *
   * @param array The array to write.
   * @param endianness Endianness of the data to write.
   * @bundle DataStream-write.js
   */
  writeFloat32Array(array: ArrayLike<number>, endianness?: Endianness): void;
  /**
   * Writes a 64-bit int to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeInt64(value: number, endianness?: Endianness): void;
  /**
   * Writes a 32-bit int to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeInt32(value: number, endianness?: Endianness): void;
  /**
   * Writes a 16-bit int to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeInt16(value: number, endianness?: Endianness): void;
  /**
   * Writes an 8-bit int to the DataStream.
   *
   * @param value Number to write.
   * @bundle DataStream-write.js
   */
  writeInt8(value: number): void;
  /**
   * Writes a 32-bit unsigned int to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeUint32(value: number, endianness?: Endianness): void;
  /**
   * Writes a 16-bit unsigned int to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeUint16(value: number, endianness?: Endianness): void;
  /**
   * Writes an 8-bit unsigned  int to the DataStream.
   *
   * @param value Number to write.
   * @bundle DataStream-write.js
   */
  writeUint8(value: number): void;
  /**
   * Writes a 32-bit float to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeFloat32(value: number, endianness?: Endianness): void;
  /**
   * Writes a 64-bit float to the DataStream with the desired endianness.
   *
   * @param value Number to write.
   * @param endianness Endianness of the number.
   * @bundle DataStream-write.js
   */
  writeFloat64(value: number, endianness?: Endianness): void;
  /**
   * Write a UCS-2 string of desired endianness to the DataStream. The
   * lengthOverride argument lets you define the number of characters to write.
   * If the string is shorter than lengthOverride, the extra space is padded with
   * zeroes.
   *
   * @param value The string to write.
   * @param endianness The endianness to use for the written string data.
   * @param lengthOverride The number of characters to write.
   * @bundle DataStream-write.js
   */
  writeUCS2String(value: string, endianness: Endianness, lengthOverride?: number): void;
  /**
   * Writes a string of desired length and encoding to the DataStream.
   *
   * @param value The string to write.
   * @param encoding The encoding for the written string data.
   *                           Defaults to ASCII.
   * @param length The number of characters to write.
   * @bundle DataStream-write.js
   */
  writeString(value: string, encoding?: string, length?: number): void;
  /**
   * Writes a null-terminated string to DataStream and zero-pads it to length
   * bytes. If length is not given, writes the string followed by a zero.
   * If string is longer than length, the written part of the string does not have
   * a trailing zero.
   *
   * @param value The string to write.
   * @param length The number of characters to write.
   * @bundle DataStream-write.js
   */
  writeCString(value: string, length?: number): void;
  /**
   * Writes a struct to the DataStream. Takes a structDefinition that gives the
   * types and a struct object that gives the values. Refer to readStruct for the
   * structure of structDefinition.
   *
   * @param structDefinition Type definition of the struct.
   * @param struct The struct data object.
   * @bundle DataStream-write.js
   */
  writeStruct<const T extends StructDefinition>(structDefinition: T, struct: StructDataFromStructDefinition<T>): void;
  /**
   * Writes object v of type t to the DataStream.
   *
   * @param type Type of data to write.
   * @param value Value of data to write.
   * @param struct Struct to pass to write callback functions.
   * @bundle DataStream-write.js
   */
  writeType<const T extends Type>(type: T, value: ValueFromType<T>, struct?: Record<string, Type>): number | void;
  /** @bundle DataStream-write.js */
  writeUint64(value: number): void;
  /** @bundle DataStream-write.js */
  writeUint24(value: number): void;
  /** @bundle DataStream-write.js */
  adjustUint32(position: number, value: number): void;
  /**
   * Reads a struct of data from the DataStream. The struct is defined as
   * an array of [name, type]-pairs. See the example below:
   *
   * ```ts
   * ds.readStruct([
   *   ['headerTag', 'uint32'], // Uint32 in DataStream endianness.
   *   ['headerTag2', 'uint32be'], // Big-endian Uint32.
   *   ['headerTag3', 'uint32le'], // Little-endian Uint32.
   *   ['array', ['[]', 'uint32', 16]], // Uint32Array of length 16.
   *   ['array2', ['[]', 'uint32', 'array2Length']] // Uint32Array of length array2Length
   * ]);
   * ```
   *
   * The possible values for the type are as follows:
   *
   * ## Number types
   *
   * Unsuffixed number types use DataStream endianness.
   * To explicitly specify endianness, suffix the type with
   * 'le' for little-endian or 'be' for big-endian,
   * e.g. 'int32be' for big-endian int32.
   *
   * - `uint8` -- 8-bit unsigned int
   * - `uint16` -- 16-bit unsigned int
   * - `uint32` -- 32-bit unsigned int
   * - `int8` -- 8-bit int
   * - `int16` -- 16-bit int
   * - `int32` -- 32-bit int
   * - `float32` -- 32-bit float
   * - `float64` -- 64-bit float
   *
   * ## String types
   *
   * - `cstring` -- ASCII string terminated by a zero byte.
   * - `string:N` -- ASCII string of length N.
   * - `string,CHARSET:N` -- String of byteLength N encoded with given CHARSET.
   * - `u16string:N` -- UCS-2 string of length N in DataStream endianness.
   * - `u16stringle:N` -- UCS-2 string of length N in little-endian.
   * - `u16stringbe:N` -- UCS-2 string of length N in big-endian.
   *
   * ## Complex types
   *
   * ### Struct
   * ```ts
   * [[name, type], [name_2, type_2], ..., [name_N, type_N]]
   * ```
   *
   * ### Callback function to read and return data
   * ```ts
   * function(dataStream, struct) {}
   * ```
   *
   * ###  Getter/setter functions
   * to read and return data, handy for using the same struct definition
   * for reading and writing structs.
   * ```ts
   * {
   *    get: function(dataStream, struct) {},
   *    set: function(dataStream, struct) {}
   * }
   * ```
   *
   * ### Array
   * Array of given type and length. The length can be either
   * - a number
   * - a string that references a previously-read field
   * - `*`
   * - a callback: `function(struct, dataStream, type){}`
   *
   * If length is `*`, reads in as many elements as it can.
   * ```ts
   * ['[]', type, length]
   * ```
   *
   * @param structDefinition Struct definition object.
   * @return The read struct. Null if failed to read struct.
   * @bundle DataStream-read-struct.js
   */
  readStruct<T extends StructDefinition>(structDefinition: T): StructDataFromStructDefinition<T>;
  /**
   * Read UCS-2 string of desired length and endianness from the DataStream.
   *
   * @param length The length of the string to read.
   * @param endianness The endianness of the string data in the DataStream.
   * @return The read string.
   * @bundle DataStream-read-struct.js
   */
  readUCS2String(length?: number, endianness?: Endianness): string;
  /**
   * Reads an object of type t from the DataStream, passing struct as the thus-far
   * read struct to possible callbacks that refer to it. Used by readStruct for
   * reading in the values, so the type is one of the readStruct types.
   *
   * @param type Type of the object to read.
   * @param struct Struct to refer to when resolving length references
   *                         and for calling callbacks.
   * @return  Returns the object on successful read, null on unsuccessful.
   * @bundle DataStream-read-struct.js
   */
  readType<const T extends Type>(type: T, struct: Record<string, Type>): ReadTypeReturnValue;
  /**
   * Maps an Int32Array into the DataStream buffer, swizzling it to native
   * endianness in-place. The current offset from the start of the buffer needs to
   * be a multiple of element size, just like with typed array views.
   *
   * Nice for quickly reading in data. Warning: potentially modifies the buffer
   * contents.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Int32Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapInt32Array(length: number, endianness?: Endianness): Int32Array<MP4BoxBuffer>;
  /**
   * Maps an Int16Array into the DataStream buffer, swizzling it to native
   * endianness in-place. The current offset from the start of the buffer needs to
   * be a multiple of element size, just like with typed array views.
   *
   * Nice for quickly reading in data. Warning: potentially modifies the buffer
   * contents.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Int16Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapInt16Array(length: number, endianness: Endianness): Int16Array<MP4BoxBuffer>;
  /**
   * Maps an Int8Array into the DataStream buffer.
   *
   * Nice for quickly reading in data.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Int8Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapInt8Array(length: number, _endianness?: Endianness): Int8Array<MP4BoxBuffer>;
  /**
   * Maps a Uint32Array into the DataStream buffer, swizzling it to native
   * endianness in-place. The current offset from the start of the buffer needs to
   * be a multiple of element size, just like with typed array views.
   *
   * Nice for quickly reading in data. Warning: potentially modifies the buffer
   * contents.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Uint32Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapUint32Array(length: number, endianness?: Endianness): Uint32Array<MP4BoxBuffer>;
  /**
   * Maps a Uint16Array into the DataStream buffer, swizzling it to native
   * endianness in-place. The current offset from the start of the buffer needs to
   * be a multiple of element size, just like with typed array views.
   *
   * Nice for quickly reading in data. Warning: potentially modifies the buffer
   * contents.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Uint16Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapUint16Array(length: number, endianness?: Endianness): Uint16Array<MP4BoxBuffer>;
  /**
   * Maps a Float64Array into the DataStream buffer, swizzling it to native
   * endianness in-place. The current offset from the start of the buffer needs to
   * be a multiple of element size, just like with typed array views.
   *
   * Nice for quickly reading in data. Warning: potentially modifies the buffer
   * contents.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Float64Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapFloat64Array(length: number, endianness?: Endianness): Float64Array<MP4BoxBuffer>;
  /**
   * Maps a Float32Array into the DataStream buffer, swizzling it to native
   * endianness in-place. The current offset from the start of the buffer needs to
   * be a multiple of element size, just like with typed array views.
   *
   * Nice for quickly reading in data. Warning: potentially modifies the buffer
   * contents.
   *
   * @param length Number of elements to map.
   * @param endianness Endianness of the data to read.
   * @return Float32Array to the DataStream backing buffer.
   * @bundle DataStream-map.js
   */
  mapFloat32Array(length: number, endianness?: Endianness): Float32Array<MP4BoxBuffer>;
}
//#endregion
//#region src/buffer.d.ts
/**
 * MultiBufferStream is a class that acts as a SimpleStream for parsing
 * It holds several, possibly non-contiguous ArrayBuffer objects, each with a fileStart property
 * containing the offset for the buffer data in an original/virtual file
 *
 * It inherits also from DataStream for all read/write/alloc operations
 */
declare class MultiBufferStream extends DataStream {
  buffers: Array<MP4BoxBuffer>;
  bufferIndex: number;
  constructor(buffer?: MP4BoxBuffer);
  /***********************************************************************************
   *                     Methods for the managnement of the buffers                  *
   *                     (insertion, removal, concatenation, ...)                    *
   ***********************************************************************************/
  initialized(): boolean;
  /**
   * Reduces the size of a given buffer, but taking the part between offset and offset+newlength
   * @param  {ArrayBuffer} buffer
   * @param  {Number}      offset    the start of new buffer
   * @param  {Number}      newLength the length of the new buffer
   * @return {ArrayBuffer}           the new buffer
   */
  reduceBuffer(buffer: MP4BoxBuffer, offset: number, newLength: number): MP4BoxBuffer;
  /**
   * Inserts the new buffer in the sorted list of buffers,
   *  making sure, it is not overlapping with existing ones (possibly reducing its size).
   *  if the new buffer overrides/replaces the 0-th buffer (for instance because it is bigger),
   *  updates the DataStream buffer for parsing
   */
  insertBuffer(ab: MP4BoxBuffer): void;
  /**
   * Displays the status of the buffers (number and used bytes)
   * @param  {Object} info callback method for display
   */
  logBufferLevel(info?: boolean): void;
  cleanBuffers(): void;
  mergeNextBuffer(): boolean;
  /*************************************************************************
   *                        Seek-related functions                         *
   *************************************************************************/
  /**
   * Finds the buffer that holds the given file position
   * @param  {Boolean} fromStart    indicates if the search should start from the current buffer (false)
   *                                or from the first buffer (true)
   * @param  {Number}  filePosition position in the file to seek to
   * @param  {Boolean} markAsUsed   indicates if the bytes in between the current position and the seek position
   *                                should be marked as used for garbage collection
   * @return {Number}               the index of the buffer holding the seeked file position, -1 if not found.
   */
  findPosition(fromStart: boolean, filePosition: number, markAsUsed: boolean): number;
  /**
   * Finds the largest file position contained in a buffer or in the next buffers if they are contiguous (no gap)
   * starting from the given buffer index or from the current buffer if the index is not given
   *
   * @param  {Number} inputindex Index of the buffer to start from
   * @return {Number}            The largest file position found in the buffers
   */
  findEndContiguousBuf(inputindex?: number): number;
  /**
   * Returns the largest file position contained in the buffers, larger than the given position
   * @param  {Number} pos the file position to start from
   * @return {Number}     the largest position in the current buffer or in the buffer and the next contiguous
   *                      buffer that holds the given position
   */
  getEndFilePositionAfter(pos: number): number;
  /*************************************************************************
   *                  Garbage collection related functions                 *
   *************************************************************************/
  /**
   * Marks a given number of bytes as used in the current buffer for garbage collection
   * @param {Number} nbBytes
   */
  addUsedBytes(nbBytes: number): void;
  /**
   * Marks the entire current buffer as used, ready for garbage collection
   */
  setAllUsedBytes(): void;
  /*************************************************************************
   *          Common API between MultiBufferStream and SimpleStream        *
   *************************************************************************/
  /**
   * Tries to seek to a given file position
   * if possible, repositions the parsing from there and returns true
   * if not possible, does not change anything and returns false
   * @param  {Number}  filePosition position in the file to seek to
   * @param  {Boolean} fromStart    indicates if the search should start from the current buffer (false)
   *                                or from the first buffer (true)
   * @param  {Boolean} markAsUsed   indicates if the bytes in between the current position and the seek position
   *                                should be marked as used for garbage collection
   * @return {Boolean}              true if the seek succeeded, false otherwise
   */
  seek(filePosition: number, fromStart?: boolean, markAsUsed?: boolean): boolean;
  /**
   * Returns the current position in the file
   * @return {Number} the position in the file
   */
  getPosition(): number;
  /**
   * Returns the length of the current buffer
   * @return {Number} the length of the current buffer
   */
  getLength(): number;
  getEndPosition(): number;
  getAbsoluteEndPosition(): number;
}
//#endregion
//#region src/box.d.ts
declare class Box {
  #private;
  size: number;
  static registryId: symbol;
  boxes?: Array<Box>;
  data: Array<number> | Uint8Array;
  has_unparsed_data?: boolean;
  hdr_size?: number;
  language: number;
  languageString?: string;
  original_size?: number;
  sizePosition?: number;
  start?: number;
  track_ids?: Uint32Array;
  box_name?: string;
  uuid?: string;
  static readonly fourcc?: string;
  get type(): string;
  set type(value: string);
  constructor(size?: number);
  addBox<T extends Box>(box: T): T;
  set<TProp extends keyof this>(prop: TProp, value: this[TProp]): this;
  addEntry(value: Box, _prop?: string): this;
  /** @bundle box-write.js */
  writeHeader(stream: DataStream, msg?: string): void;
  /** @bundle box-write.js */
  write(stream: DataStream): void;
  /** @bundle box-print.js */
  printHeader(output: Output): void;
  /** @bundle box-print.js */
  print(output: Output): void;
  /** @bundle box-parse.js */
  parse(stream: MultiBufferStream): void;
  /** @bundle box-parse.js */
  parseDataAndRewind(stream: MultiBufferStream): void;
  /** @bundle box-parse.js */
  parseLanguage(stream: MultiBufferStream): void;
  /** @bundle isofile-advanced-creation.js */
  computeSize(stream_?: MultiBufferStream): void;
  isEndOfBox(stream: MultiBufferStream): boolean;
}
declare class FullBox extends Box {
  flags: number;
  version: number;
  /** @bundle box-write.js */
  writeHeader(stream: MultiBufferStream): void;
  /** @bundle box-print.js */
  printHeader(output: Output): void;
  /** @bundle box-parse.js */
  parseDataAndRewind(stream: MultiBufferStream): void;
  /** @bundle box-parse.js */
  parseFullHeader(stream: MultiBufferStream): void;
  /** @bundle box-parse.js */
  parse(stream: MultiBufferStream): void;
}
declare class SampleGroupEntry {
  grouping_type: string;
  static registryId: symbol;
  data: ArrayLike<number>;
  description_length: number;
  constructor(grouping_type: string);
  /** @bundle writing/samplegroups/samplegroup.js */
  write(stream: MultiBufferStream): void;
  /** @bundle parsing/samplegroups/samplegroup.js */
  parse(stream: MultiBufferStream): void;
}
declare class TrackGroupTypeBox extends FullBox {
  track_group_id: number;
  /** @bundle parsing/TrackGroup.js */
  parse(stream: MultiBufferStream): void;
}
/** @bundle parsing/singleitemtypereference.js */
declare class SingleItemTypeReferenceBox extends Box {
  box_name: string;
  hdr_size: number;
  start: number;
  from_item_ID: number;
  references: Array<Reference>;
  constructor(fourcc: string, size: number, box_name: string, hdr_size: number, start: number);
  parse(stream: MultiBufferStream): void;
}
/** @bundle parsing/singleitemtypereferencelarge.js */
declare class SingleItemTypeReferenceBoxLarge extends Box {
  box_name: string;
  hdr_size: number;
  start: number;
  from_item_ID: number;
  references: Array<Reference>;
  constructor(fourcc: string, size: number, box_name: string, hdr_size: number, start: number);
  parse(stream: MultiBufferStream): void;
}
/** @bundle parsing/TrakReference.js */
declare class TrackReferenceTypeBox extends Box {
  hdr_size: number;
  start: number;
  constructor(fourcc: string, size: number, hdr_size: number, start: number);
  parse(stream: MultiBufferStream | DataStream): void;
  /** @bundle box-write.js */
  write(stream: DataStream): void;
}
declare namespace descriptor_d_exports {
  export { Descriptor, ES_Descriptor, MPEG4DescriptorParser };
}
declare class Descriptor {
  tag: number;
  size: number;
  descs: any[];
  data: Uint8Array;
  constructor(tag: number, size: number);
  parse(stream: DataStream): void;
  findDescriptor(tag: number): any;
  parseOneDescriptor(stream: DataStream): DescriptorKinds;
  parseRemainingDescriptors(stream: DataStream): void;
}
declare class ES_Descriptor extends Descriptor {
  dependsOn_ES_ID: number;
  ES_ID: number;
  flags: number;
  OCR_ES_ID: number;
  URL: string;
  constructor(size?: number);
  parse(stream: MultiBufferStream): void;
  getOTI(): any;
  getAudioConfig(): number;
}
declare class DecoderConfigDescriptor extends Descriptor {
  avgBitrate: number;
  bufferSize: number;
  maxBitrate: number;
  oti: number;
  streamType: number;
  upStream: boolean;
  constructor(size: number);
  parse(stream: MultiBufferStream): void;
}
declare class DecoderSpecificInfo extends Descriptor {
  constructor(size: number);
}
declare class SLConfigDescriptor extends Descriptor {
  constructor(size: number);
}
type DescriptorKinds = Descriptor | ES_Descriptor | DecoderConfigDescriptor | DecoderSpecificInfo | SLConfigDescriptor;
declare class MPEG4DescriptorParser {
  getDescriptorName(tag: number): any;
  parseOneDescriptor: (stream: DataStream) => DescriptorKinds;
}
//#endregion
//#region src/boxes/a1lx.d.ts
declare class a1lxBox extends Box {
  static readonly fourcc: "a1lx";
  box_name: "AV1LayeredImageIndexingProperty";
  layer_size: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/a1op.d.ts
declare class a1opBox extends Box {
  static readonly fourcc: "a1op";
  box_name: "OperatingPointSelectorProperty";
  op_index: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/auxC.d.ts
declare class auxCBox extends FullBox {
  static readonly fourcc: "auxC";
  box_name: "AuxiliaryTypeProperty";
  aux_type: string;
  aux_subtype: Uint8Array;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/btrt.d.ts
declare class btrtBox extends Box {
  static readonly fourcc: "btrt";
  box_name: "BitRateBox";
  bufferSizeDB: number;
  maxBitrate: number;
  avgBitrate: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/ccst.d.ts
declare class ccstBox extends FullBox {
  static readonly fourcc: "ccst";
  box_name: "CodingConstraintsBox";
  all_ref_pics_intra: boolean;
  intra_pred_used: boolean;
  max_ref_per_pic: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/cdef.d.ts
declare class cdefBox extends Box {
  static readonly fourcc: "cdef";
  box_name: "ComponentDefinitionBox";
  channel_count: number;
  channel_indexes: Array<number>;
  channel_types: Array<number>;
  channel_associations: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/clli.d.ts
declare class clliBox extends Box {
  static readonly fourcc: "clli";
  box_name: "ContentLightLevelBox";
  max_content_light_level: number;
  max_pic_average_light_level: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/cmex.d.ts
declare class cmexBox extends Box {
  static readonly fourcc: "cmex";
  box_name: "CameraExtrinsicMatrixProperty";
  flags: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  version: number;
  quat_x: number;
  quat_y: number;
  quat_z: number;
  id: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/cmin.d.ts
declare class cminBox extends Box {
  static readonly fourcc: "cmin";
  box_name: "CameraIntrinsicMatrixProperty";
  focal_length_x: number;
  principal_point_x: number;
  principal_point_y: number;
  flags: number;
  focal_length_y: number;
  skew_factor: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/cmpC.d.ts
declare class cmpCBox extends FullBox {
  static readonly fourcc: "cmpC";
  box_name: "CompressionConfigurationBox";
  compression_type: string;
  compressed_unit_type: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/cmpd.d.ts
declare class cmpdBox extends Box {
  static readonly fourcc: "cmpd";
  box_name: "ComponentDefinitionBox";
  component_count: number;
  component_types: Array<number>;
  component_type_urls: Array<string>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/CoLL.d.ts
declare class CoLLBox extends FullBox {
  static readonly fourcc: "CoLL";
  box_name: "ContentLightLevelBox";
  maxCLL: number;
  maxFALL: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/colr.d.ts
declare class colrBox extends Box {
  static readonly fourcc: "colr";
  box_name: "ColourInformationBox";
  colour_type: string;
  colour_primaries: number;
  transfer_characteristics: number;
  matrix_coefficients: number;
  full_range_flag: number;
  ICC_profile: Uint8Array;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/covi.d.ts
declare class SphereRegion {
  centre_azimuth: number;
  centre_elevation: number;
  centre_tilt: number;
  range_included_flag: boolean;
  azimuth_range: number;
  elevation_range: number;
  interpolate_included_flag: boolean;
  interpolate: boolean;
  toString(): string;
}
declare class CoverageSphereRegion {
  view_idc: number;
  sphere_region: SphereRegion;
  toString(): string;
}
declare class coviBox extends FullBox {
  static readonly fourcc: "covi";
  box_name: "CoverageInformationBox";
  coverage_shape_type: number;
  default_view_idc: number;
  coverage_regions: Array<CoverageSphereRegion>;
  parse(stream: MultiBufferStream): void;
  parseSphereRegion(stream: MultiBufferStream, range_included_flag: boolean, interpolate_included_flag: boolean): SphereRegion;
}
//#endregion
//#region src/boxes/cprt.d.ts
declare class cprtBox extends FullBox {
  static readonly fourcc: "cprt";
  box_name: "CopyrightBox";
  notice: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/csch.d.ts
declare class cschBox extends FullBox {
  static readonly fourcc: "csch";
  box_name: "CompatibleSchemeTypeBox";
  scheme_type: string;
  scheme_version: number;
  scheme_uri: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dac3.d.ts
declare class dac3Box extends Box {
  static readonly fourcc: "dac3";
  box_name: "AC3SpecificBox";
  fscod: number;
  bsid: number;
  bsmod: number;
  acmod: number;
  lfeon: number;
  bit_rate_code: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dec3.d.ts
interface IndSub {
  fscod: number;
  bsid: number;
  bsmod: number;
  acmod: number;
  lfeon: number;
  num_dep_sub: number;
  chan_loc?: number;
}
declare class dec3Box extends Box {
  static readonly fourcc: "dec3";
  box_name: "EC3SpecificBox";
  data_rate: number;
  num_ind_sub: number;
  ind_subs: Array<IndSub>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dfLa.d.ts
declare class dfLaBox extends FullBox {
  static readonly fourcc: "dfLa";
  box_name: "FLACSpecificBox";
  samplerate: number;
  numMetadataBlocks: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dimm.d.ts
declare class dimmBox extends Box {
  static readonly fourcc: "dimm";
  box_name: "hintimmediateBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dmax.d.ts
declare class dmax extends Box {
  static readonly fourcc: "dmax";
  box_name: "hintlongestpacket";
  time: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dmed.d.ts
declare class dmedBox extends Box {
  static readonly fourcc: "dmed";
  box_name: "hintmediaBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/dOps.d.ts
declare class dOpsBox extends Box {
  static readonly fourcc: "dOps";
  box_name: "OpusSpecificBox";
  Version: number;
  OutputChannelCount: number;
  PreSkip: number;
  InputSampleRate: number;
  OutputGain: number;
  ChannelMappingFamily: number;
  StreamCount: number;
  CoupledCount: number;
  ChannelMapping: Array<number>;
  parse(stream: MultiBufferStream): void;
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/drep.d.ts
declare class drepBox extends Box {
  static readonly fourcc: "drep";
  box_name: "hintrepeatedBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/emsg.d.ts
declare class emsgBox extends FullBox {
  static readonly fourcc: "emsg";
  box_name: "EventMessageBox";
  timescale: number;
  presentation_time: number;
  event_duration: number;
  id: number;
  scheme_id_uri: string;
  value: string;
  presentation_time_delta: number;
  message_data: Uint8Array;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/emsg.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/EntityToGroup/index.d.ts
declare class aebrBox extends EntityToGroup {
  static readonly fourcc: "aebr";
  box_name: "Auto exposure bracketing";
}
declare class afbrBox extends EntityToGroup {
  static readonly fourcc: "afbr";
  box_name: "Flash exposure information";
}
declare class albcBox extends EntityToGroup {
  static readonly fourcc: "albc";
  box_name: "Album collection";
}
declare class altrBox extends EntityToGroup {
  static readonly fourcc: "altr";
  box_name: "Alternative entity";
}
declare class brstBox extends EntityToGroup {
  static readonly fourcc: "brst";
  box_name: "Burst image";
}
declare class dobrBox extends EntityToGroup {
  static readonly fourcc: "dobr";
  box_name: "Depth of field bracketing";
}
declare class eqivBox extends EntityToGroup {
  static readonly fourcc: "eqiv";
  box_name: "Equivalent entity";
}
declare class favcBox extends EntityToGroup {
  static readonly fourcc: "favc";
  box_name: "Favorites collection";
}
declare class fobrBox extends EntityToGroup {
  static readonly fourcc: "fobr";
  box_name: "Focus bracketing";
}
declare class iaugBox extends EntityToGroup {
  static readonly fourcc: "iaug";
  box_name: "Image item with an audio track";
}
declare class panoBox extends EntityToGroup {
  static readonly fourcc: "pano";
  box_name: "Panorama";
}
declare class slidBox extends EntityToGroup {
  static readonly fourcc: "slid";
  box_name: "Slideshow";
}
declare class sterBox extends EntityToGroup {
  static readonly fourcc: "ster";
  box_name: "Stereo";
}
declare class tsynBox extends EntityToGroup {
  static readonly fourcc: "tsyn";
  box_name: "Time-synchronized capture";
}
declare class wbbrBox extends EntityToGroup {
  static readonly fourcc: "wbbr";
  box_name: "White balance bracketing";
}
declare class prgrBox extends EntityToGroup {
  static readonly fourcc: "prgr";
  box_name: "Progressive rendering";
}
declare class pymdBox extends EntityToGroup {
  tile_size_x: number;
  tile_size_y: number;
  layer_binning: Array<number>;
  tiles_in_layer_column_minus1: Array<number>;
  tiles_in_layer_row_minus1: Array<number>;
  static readonly fourcc: "pymd";
  box_name: "Image pyramid";
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/esds.d.ts
declare class esdsBox extends FullBox {
  static readonly fourcc: "esds";
  box_name: "ElementaryStreamDescriptorBox";
  esd: ES_Descriptor;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/fiel.d.ts
declare class fielBox extends Box {
  static readonly fourcc: "fiel";
  box_name: "FieldHandlingBox";
  fieldCount: number;
  fieldOrdering: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/frma.d.ts
declare class frmaBox extends Box {
  static readonly fourcc: "frma";
  box_name: "OriginalFormatBox";
  data_format: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/imir.d.ts
declare class imirBox extends Box {
  static readonly fourcc: "imir";
  box_name: "ImageMirror";
  reserved: number;
  axis: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/itai.d.ts
declare class itaiBox extends FullBox {
  static readonly fourcc: "itai";
  box_name: "TAITimestampBox";
  TAI_timestamp: number;
  sychronization_state: number;
  timestamp_generation_failure: number;
  timestamp_is_modified: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/leva.d.ts
interface Level {
  padding_flag: number;
  track_ID: number;
  assignment_type: number;
  grouping_type: string;
  grouping_type_parameter: number;
  sub_track_id: number;
}
declare class levaBox extends FullBox {
  static readonly fourcc: "leva";
  box_name: "LevelAssignmentBox";
  levels: Array<Level>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/lhvC.d.ts
declare class lhvCBox extends Box {
  static readonly fourcc: "lhvC";
  box_name: "LHEVCConfigurationBox";
  configurationVersion: number;
  min_spatial_segmentation_idc: number;
  parallelismType: number;
  numTemporalLayers: number;
  temporalIdNested: number;
  lengthSizeMinusOne: number;
  nalu_arrays: NALUArrays;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/lsel.d.ts
declare class lselBox extends Box {
  static readonly fourcc: "lsel";
  box_name: "LayerSelectorProperty";
  layer_id: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/displays/colorPoint.d.ts
declare class ColorPoint {
  x: number;
  y: number;
  constructor(x: number, y: number);
  toString(): string;
}
//#endregion
//#region src/boxes/mdcv.d.ts
declare class mdcvBox extends Box {
  static readonly fourcc: "mdcv";
  box_name: "MasteringDisplayColourVolumeBox";
  display_primaries: Array<ColorPoint>;
  white_point: ColorPoint;
  max_display_mastering_luminance: number;
  min_display_mastering_luminance: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/mfro.d.ts
declare class mfroBox extends FullBox {
  static readonly fourcc: "mfro";
  box_name: "MovieFragmentRandomAccessOffsetBox";
  _size: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/mskC.d.ts
declare class mskCBox extends FullBox {
  static readonly fourcc: "mskC";
  box_name: "MaskConfigurationProperty";
  bits_per_pixel: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/npck.d.ts
declare class npckBox extends Box {
  static readonly fourcc: "npck";
  box_name: "hintPacketsSent";
  packetssent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/nump.d.ts
declare class numpBox extends Box {
  static readonly fourcc: "nump";
  box_name: "hintPacketsSent";
  packetssent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/padb.d.ts
declare class PaddingBit {
  pad1: number;
  pad2: number;
  constructor(pad1: number, pad2: number);
}
declare class padbBox extends FullBox {
  static readonly fourcc: "padb";
  box_name: "PaddingBitsBox";
  padbits: Array<PaddingBit>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/pasp.d.ts
declare class paspBox extends Box {
  static readonly fourcc: "pasp";
  box_name: "PixelAspectRatioBox";
  hSpacing: number;
  vSpacing: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/payl.d.ts
declare class paylBox extends Box {
  static readonly fourcc: "payl";
  box_name: "CuePayloadBox";
  text: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/payt.d.ts
declare class paytBox extends Box {
  static readonly fourcc: "payt";
  box_name: "hintpayloadID";
  payloadID: number;
  rtpmap_string: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/pdin.d.ts
declare class pdinBox extends FullBox {
  static readonly fourcc: "pdin";
  box_name: "ProgressiveDownloadInfoBox";
  rate: Array<number>;
  initial_delay: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/pixi.d.ts
declare class pixiBox extends FullBox {
  static readonly fourcc: "pixi";
  box_name: "PixelInformationProperty";
  num_channels: number;
  bits_per_channels: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/pmax.d.ts
declare class pmaxBox extends Box {
  static readonly fourcc: "pmax";
  box_name: "hintlargestpacket";
  bytes: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/prdi.d.ts
declare class prdiBox extends FullBox {
  static readonly fourcc: "prdi";
  box_name: "ProgressiveDerivedImageItemInformationProperty";
  step_count: number;
  item_count: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/prfr.d.ts
declare class prfrBox extends FullBox {
  static readonly fourcc: "prfr";
  box_name: "ProjectionFormatBox";
  projection_type: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/prft.d.ts
declare class prftBox extends FullBox {
  static readonly fourcc: "prft";
  box_name: "ProducerReferenceTimeBox";
  ref_track_id: number;
  ntp_timestamp: number;
  media_time: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/clef.d.ts
declare class clefBox extends FullBox {
  static readonly fourcc: "clef";
  box_name: "TrackCleanApertureDimensionsBox";
  width: number;
  height: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/data.d.ts
declare class dataBox extends Box {
  static readonly fourcc: "data";
  box_name: "DataBox";
  country: number;
  countryString?: string;
  language: number;
  languageString?: string;
  raw: Uint8Array;
  value?: string | number | bigint | boolean | object;
  valueType: number;
  static Types: {
    readonly RESERVED: 0;
    readonly UTF8: 1;
    readonly UTF16: 2;
    readonly SJIS: 3;
    readonly UTF8_SORT: 4;
    readonly UTF16_SORT: 5;
    readonly JPEG: 13;
    readonly PNG: 14;
    readonly BE_SIGNED_INT: 21;
    readonly BE_UNSIGNED_INT: 22;
    readonly BE_FLOAT32: 23;
    readonly BE_FLOAT64: 24;
    readonly BMP: 27;
    readonly QT_ATOM: 28;
    readonly BE_SIGNED_INT8: 65;
    readonly BE_SIGNED_INT16: 66;
    readonly BE_SIGNED_INT32: 67;
    readonly BE_FLOAT32_POINT: 70;
    readonly BE_FLOAT32_DIMENSIONS: 71;
    readonly BE_FLOAT32_RECT: 72;
    readonly BE_SIGNED_INT64: 74;
    readonly BE_UNSIGNED_INT8: 75;
    readonly BE_UNSIGNED_INT16: 76;
    readonly BE_UNSIGNED_INT32: 77;
    readonly BE_UNSIGNED_INT64: 78;
    readonly BE_FLOAT64_AFFINE_TRANSFORM: 79;
  };
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/enof.d.ts
declare class enofBox extends FullBox {
  static readonly fourcc: "enof";
  box_name: "TrackEncodedPixelsDimensionsBox";
  width: number;
  height: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/ilst.d.ts
declare class ilstBox extends Box {
  static readonly fourcc: "ilst";
  box_name: "IlstBox";
  list: Record<number, Box>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/keys.d.ts
declare class keysBox extends FullBox {
  static readonly fourcc: "keys";
  box_name: "KeysBox";
  count: number;
  keys: Record<number, string>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/prof.d.ts
declare class profBox extends FullBox {
  static readonly fourcc: "prof";
  box_name: "TrackProductionApertureDimensionsBox";
  width: number;
  height: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/qt/tapt.d.ts
declare class taptBox extends ContainerBox {
  static readonly fourcc: "tapt";
  box_name: "TrackApertureModeDimensionsBox";
  clefs: Array<clefBox>;
  profs: Array<profBox>;
  enofs: Array<enofBox>;
  subBoxNames: readonly ["clef", "prof", "enof"];
}
//#endregion
//#region src/boxes/qt/wave.d.ts
declare class waveBox extends ContainerBox {
  static readonly fourcc: "wave";
  box_name: "siDecompressionParamBox";
  esds: esdsBox;
}
//#endregion
//#region src/boxes/rtp.d.ts
declare class rtp_Box extends Box {
  static readonly fourcc: "rtp ";
  box_name: "rtpmoviehintinformation";
  descriptionformat: string;
  sdptext: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/saio.d.ts
declare class saioBox extends FullBox {
  static readonly fourcc: "saio";
  box_name: "SampleAuxiliaryInformationOffsetsBox";
  aux_info_type: string;
  aux_info_type_parameter: number;
  entry_count: number;
  offset: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/saiz.d.ts
declare class saizBox extends FullBox {
  static readonly fourcc: "saiz";
  box_name: "SampleAuxiliaryInformationSizesBox";
  aux_info_type: string;
  aux_info_type_parameter: number;
  default_sample_info_size: number;
  sample_count: number;
  sample_info_size: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/mett.d.ts
declare class mettSampleEntry extends MetadataSampleEntry {
  content_encoding: string;
  mime_format: string;
  static readonly fourcc: "mett";
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/metx.d.ts
declare class metxSampleEntry extends MetadataSampleEntry {
  content_encoding: string;
  namespace: string;
  schema_location: string;
  static readonly fourcc: "metx";
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/sampleentry.d.ts
declare class avcCSampleEntryBase extends VisualSampleEntry {
  avcC: avcCBox;
  avcCs: Array<avcCBox>;
  /** @bundle box-codecs.js */
  getCodec(): string;
}
declare class avc1SampleEntry extends avcCSampleEntryBase {
  static readonly fourcc: "avc1";
  box_name: "AVCSampleEntry";
}
declare class avc2SampleEntry extends avcCSampleEntryBase {
  static readonly fourcc: "avc2";
  box_name: "AVC2SampleEntry";
}
declare class avc3SampleEntry extends avcCSampleEntryBase {
  static readonly fourcc: "avc3";
  box_name: "AVCSampleEntry";
}
declare class avc4SampleEntry extends avcCSampleEntryBase {
  static readonly fourcc: "avc4";
  box_name: "AVC2SampleEntry";
}
declare class av01SampleEntry extends VisualSampleEntry {
  av1C: av1CBox;
  av1Cs: Array<av1CBox>;
  static readonly fourcc: "av01";
  box_name: "AV1SampleEntry";
  /** @bundle box-codecs.js */
  getCodec(): string;
}
declare class dav1SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "dav1";
}
declare class hvcCSampleEntryBase extends VisualSampleEntry {
  hvcC: hvcCBox;
  hvcCs: Array<hvcCBox>;
  /** @bundle box-codecs.js */
  getCodec(): string;
}
declare class hvc1SampleEntry extends hvcCSampleEntryBase {
  static readonly fourcc: "hvc1";
  box_name: "HEVCSampleEntry";
}
declare class hvc2SampleEntry extends hvcCSampleEntryBase {
  static readonly fourcc: "hvc2";
}
declare class hev1SampleEntry extends hvcCSampleEntryBase {
  static readonly fourcc: "hev1";
  box_name: "HEVCSampleEntry";
  colrs: Array<colrBox>;
  subBoxNames: readonly ["colr"];
}
declare class hev2SampleEntry extends hvcCSampleEntryBase {
  static readonly fourcc: "hev2";
}
declare class hvt1SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "hvt1";
  box_name: "HEVCTileSampleSampleEntry";
}
declare class lhe1SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "lhe1";
  box_name: "LHEVCSampleEntry";
}
declare class lhv1SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "lhv1";
  box_name: "LHEVCSampleEntry";
}
declare class lvc1SampleEntry extends VisualSampleEntry {
  lvcC: lvcCBox;
  lvcCs: Array<lvcCBox>;
  static readonly fourcc: "lvc1";
  box_name: "LCEVCSampleEntry";
  /** @bundle box-codecs.js */
  getCodec(): string;
}
declare class dvh1SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "dvh1";
}
declare class dvheSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "dvhe";
}
/** @babel box-codecs.js */
declare class vvcCSampleEntryBase extends VisualSampleEntry {
  vvcC: vvcCBox;
  vvcCs: Array<vvcCBox>;
  getCodec(): string;
}
declare class vvc1SampleEntry extends vvcCSampleEntryBase {
  static readonly fourcc: "vvc1";
  box_name: "VvcSampleEntry";
}
declare class vvi1SampleEntry extends vvcCSampleEntryBase {
  static readonly fourcc: "vvi1";
  box_name: "VvcSampleEntry";
}
declare class vvs1SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "vvs1";
  box_name: "VvcSampleEntry";
}
declare class vvcNSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "vvcN";
  box_name: "VvcNonVCLSampleEntry";
}
declare class vpcCSampleEntryBase extends VisualSampleEntry {
  vpcC: vpcCBox;
  vpcCs: Array<vpcCBox>;
  getCodec(): string;
}
declare class vp08SampleEntry extends vpcCSampleEntryBase {
  static readonly fourcc: "vp08";
}
declare class vp09SampleEntry extends vpcCSampleEntryBase {
  static readonly fourcc: "vp09";
}
declare class avs3SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "avs3";
}
declare class j2kiSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "j2ki";
  box_name: "J2KSampleEntry";
}
declare class mjp2SampleEntry extends VisualSampleEntry {
  static readonly fourcc: "mjp2";
}
declare class mjpgSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "mjpg";
}
declare class uncvSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "uncv";
  box_name: "UncompressedVideoSampleEntry";
}
declare class mp4vSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "mp4v";
  box_name: "MP4VisualSampleEntry";
}
declare class mp4aSampleEntry extends AudioSampleEntry {
  static readonly fourcc: "mp4a";
  box_name: "MP4AudioSampleEntry";
  esds: esdsBox;
  esdss: Array<esdsBox>;
  wave: waveBox;
  getCodec(): string;
}
declare class m4aeSampleEntry extends AudioSampleEntry {
  static readonly fourcc: "m4ae";
}
declare class ac_3SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "ac-3";
}
declare class ac_4SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "ac-4";
}
declare class ec_3SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "ec-3";
}
declare class OpusSampleEntry extends AudioSampleEntry {
  static readonly fourcc: "Opus";
}
declare class mha1SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "mha1";
}
declare class mha2SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "mha2";
}
declare class mhm1SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "mhm1";
}
declare class mhm2SampleEntry extends AudioSampleEntry {
  static readonly fourcc: "mhm2";
}
declare class fLaCSampleEntry extends AudioSampleEntry {
  static readonly fourcc: "fLaC";
}
declare class encvSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "encv";
}
declare class encaSampleEntry extends AudioSampleEntry {
  static readonly fourcc: "enca";
}
declare class encuSampleEntry extends SubtitleSampleEntry {
  static readonly fourcc: "encu";
  subBoxNames: readonly ["sinf"];
  sinfs: Array<sinfBox>;
}
declare class encsSampleEntry extends SystemSampleEntry {
  static readonly fourcc: "encs";
  subBoxNames: readonly ["sinf"];
  sinfs: Array<sinfBox>;
}
declare class mp4sSampleEntry extends SystemSampleEntry {
  static readonly fourcc: "mp4s";
  esds: esdsBox;
}
declare class enctSampleEntry extends TextSampleEntry {
  static readonly fourcc: "enct";
  subBoxNames: readonly ["sinf"];
  sinfs: Array<sinfBox>;
}
declare class encmSampleEntry extends MetadataSampleEntry {
  static readonly fourcc: "encm";
  subBoxNames: readonly ["sinf"];
  sinfs: Array<sinfBox>;
}
declare class resvSampleEntry extends VisualSampleEntry {
  static readonly fourcc: "resv";
  box_name: "RestrictedVideoSampleEntry";
}
//#endregion
//#region src/boxes/sampleentries/sbtt.d.ts
declare class sbttSampleEntry extends SubtitleSampleEntry {
  content_encoding: string;
  mime_format: string;
  static readonly fourcc: "sbtt";
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/stpp.d.ts
declare class stppSampleEntry extends SubtitleSampleEntry {
  namespace: string;
  schema_location: string;
  auxiliary_mime_types: string;
  static readonly fourcc: "stpp";
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/sampleentry.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/stxt.d.ts
declare class stxtSampleEntry extends SubtitleSampleEntry {
  content_encoding: string;
  mime_format: string;
  static readonly fourcc: "stxt";
  parse(stream: MultiBufferStream): void;
  getCodec(): string;
}
//#endregion
//#region src/boxes/sampleentries/tx3g.d.ts
declare class tx3gSampleEntry extends SubtitleSampleEntry {
  displayFlags: number;
  horizontal_justification: number;
  vertical_justification: number;
  bg_color_rgba: Uint8Array;
  box_record: Int16Array;
  style_record: Uint8Array;
  static readonly fourcc: "tx3g";
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sampleentries/wvtt.d.ts
declare class wvttSampleEntry extends MetadataSampleEntry {
  static readonly fourcc: "wvtt";
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/displays/pixel.d.ts
declare class Pixel {
  bad_pixel_row: number;
  bad_pixel_column: number;
  constructor(bad_pixel_row: number, bad_pixel_column: number);
  toString(): string;
}
//#endregion
//#region src/boxes/sbpm.d.ts
declare class sbpmBox extends FullBox {
  static readonly fourcc: "sbpm";
  box_name: "SensorBadPixelsMapBox";
  component_count: number;
  component_index: Array<number>;
  correction_applied: boolean;
  num_bad_rows: number;
  num_bad_cols: number;
  num_bad_pixels: number;
  bad_rows: Array<number>;
  bad_columns: Array<number>;
  bad_pixels: Array<Pixel>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/schm.d.ts
declare class schmBox extends FullBox {
  static readonly fourcc: "schm";
  box_name: "SchemeTypeBox";
  scheme_type: string;
  scheme_version: number;
  scheme_uri: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/sdp.d.ts
declare class sdp_Box extends Box {
  static readonly fourcc: "sdp ";
  box_name: "rtptracksdphintinformation";
  sdptext?: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/senc.d.ts
declare class sencBox extends FullBox {
  static readonly fourcc: "senc";
  box_name: "SampleEncryptionBox";
}
//#endregion
//#region src/boxes/SmDm.d.ts
declare class SmDmBox extends FullBox {
  static readonly fourcc: "SmDm";
  box_name: "SMPTE2086MasteringDisplayMetadataBox";
  primaryRChromaticity_x: number;
  primaryRChromaticity_y: number;
  primaryGChromaticity_x: number;
  primaryGChromaticity_y: number;
  primaryBChromaticity_x: number;
  primaryBChromaticity_y: number;
  whitePointChromaticity_x: number;
  whitePointChromaticity_y: number;
  luminanceMax: number;
  luminanceMin: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/srat.d.ts
declare class sratBox extends FullBox {
  static readonly fourcc: "srat";
  box_name: "SamplingRateBox";
  sampling_rate: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/ssix.d.ts
interface Range {
  level: number;
  range_size: number;
}
interface SubSegment {
  ranges: Array<Range>;
}
declare class ssixBox extends FullBox {
  static readonly fourcc: "ssix";
  box_name: "CompressedSubsegmentIndexBox";
  subsegments: Array<SubSegment>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stri.d.ts
declare class striBox extends FullBox {
  static readonly fourcc: "stri";
  box_name: "SubTrackInformationBox";
  switch_group: number;
  alternate_group: number;
  sub_track_id: number;
  attribute_list: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stsg.d.ts
declare class stsgBox extends FullBox {
  static readonly fourcc: "stsg";
  box_name: "SubTrackSampleGroupBox";
  grouping_type: number;
  group_description_index: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stsh.d.ts
declare class stshBox extends FullBox {
  static readonly fourcc: "stsh";
  box_name: "ShadowSyncSampleBox";
  shadowed_sample_numbers: Array<number>;
  sync_sample_numbers: Array<number>;
  parse(stream: MultiBufferStream): void;
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/stvi.d.ts
declare class stviBox extends FullBox {
  static readonly fourcc: "stvi";
  box_name: "StereoVideoBox";
  single_view_allowed: number;
  stereo_scheme: number;
  stereo_indication_type: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/styp.d.ts
declare class stypBox extends Box {
  static readonly fourcc: "styp";
  box_name: "SegmentTypeBox";
  major_brand: string;
  minor_version: number;
  compatible_brands: Array<string>;
  parse(stream: MultiBufferStream): void;
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/taic.d.ts
declare class taicBox extends FullBox {
  static readonly fourcc: "taic";
  box_name: "TAIClockInfoBox";
  time_uncertainty: number;
  clock_resolution: number;
  clock_drift_rate: number;
  clock_type: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tenc.d.ts
declare class tencBox extends FullBox {
  static readonly fourcc: "tenc";
  box_name: "TrackEncryptionBox";
  default_crypt_byte_block: number;
  default_skip_byte_block: number;
  default_isProtected: number;
  default_Per_Sample_IV_Size: number;
  default_KID: string;
  default_constant_IV_size: number;
  default_constant_IV: Uint8Array;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tmax.d.ts
declare class tmaxBox extends Box {
  static readonly fourcc: "tmax";
  box_name: "hintmaxrelativetime";
  time: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tmin.d.ts
declare class tminBox extends Box {
  static readonly fourcc: "tmin";
  box_name: "hintminrelativetime";
  time: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/totl.d.ts
declare class totlBox extends Box {
  static readonly fourcc: "totl";
  box_name: "hintBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tpay.d.ts
declare class tpayBox extends Box {
  static readonly fourcc: "tpay";
  box_name: "hintBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tpyl.d.ts
declare class tpylBox extends Box {
  static readonly fourcc: "tpyl";
  box_name: "hintBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/trackgroups/msrc.d.ts
declare class msrcTrackGroupTypeBox extends TrackGroupTypeBox {
  static readonly fourcc: "msrc";
}
//#endregion
//#region src/boxes/trep.d.ts
declare class trepBox extends FullBox {
  static readonly fourcc: "trep";
  box_name: "TrackExtensionPropertiesBox";
  track_ID: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/trpy.d.ts
declare class trpyBox extends Box {
  static readonly fourcc: "trpy";
  box_name: "hintBytesSent";
  bytessent: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/tsel.d.ts
declare class tselBox extends FullBox {
  static readonly fourcc: "tsel";
  box_name: "TrackSelectionBox";
  switch_group: number;
  attribute_list: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/txtC.d.ts
declare class txtcBox extends FullBox {
  static readonly fourcc: "txtc";
  box_name: "TextConfigBox";
  config: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/udes.d.ts
declare class udesBox extends FullBox {
  static readonly fourcc: "udes";
  box_name: "UserDescriptionProperty";
  lang: string;
  name: string;
  description: string;
  tags: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/uncC.d.ts
declare class uncCBox extends FullBox {
  static readonly fourcc: "uncC";
  box_name: "UncompressedFrameConfigBox";
  profile: string;
  component_count: number;
  component_index: Array<number>;
  component_bit_depth_minus_one: Array<number>;
  component_format: Array<number>;
  component_align_size: Array<number>;
  sampling_type: number;
  interleave_type: number;
  block_size: number;
  component_little_endian: number;
  block_pad_lsb: number;
  block_little_endian: number;
  block_reversed: number;
  pad_unknown: number;
  pixel_size: number;
  row_align_size: number;
  tile_align_size: number;
  num_tile_cols_minus_one: number;
  num_tile_rows_minus_one: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/url.d.ts
declare class urlBox extends FullBox {
  static readonly fourcc: "url ";
  box_name: "DataEntryUrlBox";
  location?: string;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/url.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/urn.d.ts
declare class urnBox extends FullBox {
  static readonly fourcc: "urn ";
  box_name: "DataEntryUrnBox";
  name: string;
  location: string;
  parse(stream: MultiBufferStream): void;
  /** @bundle writing/urn.js */
  write(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/vttC.d.ts
declare class vttCBox extends Box {
  static readonly fourcc: "vttC";
  box_name: "WebVTTConfigurationBox";
  text: string;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/vvnC.d.ts
declare class vvnCBox extends FullBox {
  static readonly fourcc: "vvnC";
  box_name: "VvcNALUConfigBox";
  lengthSizeMinusOne: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/alst.d.ts
declare class alstSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "alst";
  first_output_sample: number;
  sample_offset: Array<number>;
  num_output_samples: Array<number>;
  num_total_samples: Array<number>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/avll.d.ts
declare class avllSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "avll";
  layerNumber: number;
  accurateStatisticsFlag: number;
  avgBitRate: number;
  avgFrameRate: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/avss.d.ts
declare class avssSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "avss";
  subSequenceIdentifier: number;
  layerNumber: number;
  durationFlag: number;
  avgRateFlag: number;
  duration: number;
  accurateStatisticsFlag: number;
  avgBitRate: number;
  avgFrameRate: number;
  dependency: Array<{
    subSeqDirectionFlag: number;
    layerNumber: number;
    subSequenceIdentifier: number;
  }>;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/dtrt.d.ts
declare class dtrtSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "dtrt";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/mvif.d.ts
declare class mvifSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "mvif";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/prol.d.ts
declare class prolSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "prol";
  roll_distance: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/rap.d.ts
declare class rapSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "rap ";
  num_leading_samples_known: number;
  num_leading_samples: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/rash.d.ts
declare class rashSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "rash";
  operation_point_count: number;
  target_rate_share: number | Array<number>;
  available_bitrate: Array<number>;
  maximum_bitrate: number;
  minimum_bitrate: number;
  discard_priority: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/roll.d.ts
declare class rollSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "roll";
  roll_distance: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/scif.d.ts
declare class scifSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "scif";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/scnm.d.ts
declare class scnmSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "scnm";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/seig.d.ts
declare class seigSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "seig";
  reserved: number;
  crypt_byte_block: number;
  skip_byte_block: number;
  isProtected: number;
  Per_Sample_IV_Size: number;
  KID: string;
  constant_IV_size: number;
  constant_IV: number | Uint8Array;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/stsa.d.ts
declare class stsaSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "stsa";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/sync.d.ts
declare class syncSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "sync";
  NAL_unit_type: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/tele.d.ts
declare class teleSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "tele";
  level_independently_decodable: number;
  parse(stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/tsas.d.ts
declare class tsasSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "tsas";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/tscl.d.ts
declare class tsclSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "tscl";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/samplegroups/vipr.d.ts
declare class viprSampleGroupEntry extends SampleGroupEntry {
  static grouping_type: "vipr";
  parse(_stream: MultiBufferStream): void;
}
//#endregion
//#region src/boxes/uuid/index.d.ts
declare class UUIDBox extends Box {
  static readonly fourcc: "uuid";
  static uuid?: string;
}
declare class UUIDFullBox extends FullBox {
  static readonly fourcc: "uuid";
  static uuid?: string;
}
declare class piffLsmBox extends UUIDFullBox {
  static uuid: "a5d40b30e81411ddba2f0800200c9a66";
  box_name: "LiveServerManifestBox";
  LiveServerManifest: string;
  parse(stream: MultiBufferStream): void;
}
declare class piffPsshBox extends UUIDFullBox {
  static uuid: "d08a4f1810f34a82b6c832d8aba183d3";
  box_name: "PiffProtectionSystemSpecificHeaderBox";
  system_id: string;
  parse(stream: MultiBufferStream): void;
}
declare class piffSencBox extends UUIDFullBox {
  static uuid: "a2394f525a9b4f14a2446c427c648df4";
  box_name: "PiffSampleEncryptionBox";
}
declare class piffTencBox extends UUIDFullBox {
  static uuid: "8974dbce7be74c5184f97148f9882554";
  box_name: "PiffTrackEncryptionBox";
  default_AlgorithmID: number;
  default_IV_size: number;
  default_KID: string;
  parse(stream: MultiBufferStream): void;
}
declare class piffTfrfBox extends UUIDFullBox {
  static uuid: "d4807ef2ca3946958e5426cb9e46a79f";
  box_name: "TfrfBox";
  fragment_count: number;
  entries: Array<{
    absolute_time: number;
    absolute_duration: number;
  }>;
  parse(stream: MultiBufferStream): void;
}
declare class piffTfxdBox extends UUIDFullBox {
  static uuid: "6d1d9b0542d544e680e2141daff757b2";
  box_name: "TfxdBox";
  absolute_time: number;
  duration: number;
  parse(stream: MultiBufferStream): void;
}
declare class ItemContentIDPropertyBox extends UUIDBox {
  static uuid: "261ef3741d975bbaacbd9d2c8ea73522";
  box_name: "ItemContentIDProperty";
  content_id: string;
  parse(stream: MultiBufferStream): void;
}
declare class ItemComponentContentIDPropertyBox extends UUIDBox {
  static uuid: "9db9dd6e373c5a4e811021fc83a911fd";
  box_name: "ItemComponentContentIDProperty";
  content_ids: Array<string>;
  number_of_components: number;
  parse(stream: MultiBufferStream): void;
}
declare namespace all_boxes_d_exports {
  export { Assocation, CoLLBox, Extent, ItemComponentContentIDPropertyBox, ItemContentIDPropertyBox, OpusSampleEntry, SmDmBox, a1lxBox, a1opBox, ac_3SampleEntry, ac_4SampleEntry, aebrBox, afbrBox, albcBox, alstSampleGroupEntry, altrBox, auxCBox, av01SampleEntry, av1CBox, avc1SampleEntry, avc2SampleEntry, avc3SampleEntry, avc4SampleEntry, avcCBox, avllSampleGroupEntry, avs3SampleEntry, avssSampleGroupEntry, brstBox, btrtBox, bxmlBox, ccstBox, cdefBox, clapBox, clefBox, clliBox, cmexBox, cminBox, cmpCBox, cmpdBox, co64Box, colrBox, coviBox, cprtBox, cschBox, cslgBox, cttsBox, dOpsBox, dac3Box, dataBox, dav1SampleEntry, dec3Box, dfLaBox, dimmBox, dinfBox, dmax, dmedBox, dobrBox, drefBox, drepBox, dtrtSampleGroupEntry, dvh1SampleEntry, dvheSampleEntry, ec_3SampleEntry, edtsBox, elngBox, elstBox, emsgBox, encaSampleEntry, encmSampleEntry, encsSampleEntry, enctSampleEntry, encuSampleEntry, encvSampleEntry, enofBox, eqivBox, esdsBox, etypBox, fLaCSampleEntry, favcBox, fielBox, fobrBox, freeBox, frmaBox, ftypBox, grplBox, hdlrBox, hev1SampleEntry, hev2SampleEntry, hinfBox, hmhdBox, hntiBox, hvc1SampleEntry, hvc2SampleEntry, hvcCBox, hvt1SampleEntry, iaugBox, idatBox, iinfBox, ilocBox, ilstBox, imirBox, infeBox, iodsBox, ipcoBox, ipmaBox, iproBox, iprpBox, irefBox, irotBox, ispeBox, itaiBox, j2kHBox, j2kiSampleEntry, keysBox, kindBox, levaBox, lhe1SampleEntry, lhv1SampleEntry, lhvCBox, lselBox, lvc1SampleEntry, lvcCBox, m4aeSampleEntry, maxrBox, mdatBox, mdcvBox, mdhdBox, mdiaBox, mecoBox, mehdBox, metaBox, mettSampleEntry, metxSampleEntry, mfhdBox, mfraBox, mfroBox, mha1SampleEntry, mha2SampleEntry, mhm1SampleEntry, mhm2SampleEntry, minfBox, mjp2SampleEntry, mjpgSampleEntry, moofBox, moovBox, mp4aSampleEntry, mp4sSampleEntry, mp4vSampleEntry, mskCBox, msrcTrackGroupTypeBox, mvexBox, mvhdBox, mvifSampleGroupEntry, nmhdBox, npckBox, numpBox, padbBox, panoBox, paspBox, paylBox, paytBox, pdinBox, piffLsmBox, piffPsshBox, piffSencBox, piffTencBox, piffTfrfBox, piffTfxdBox, pitmBox, pixiBox, pmaxBox, povdBox, prdiBox, prfrBox, prftBox, prgrBox, profBox, prolSampleGroupEntry, psshBox, pymdBox, rapSampleGroupEntry, rashSampleGroupEntry, resvSampleEntry, rinfBox, rollSampleGroupEntry, rtp_Box, saioBox, saizBox, sbgpBox, sbpmBox, sbttSampleEntry, schiBox, schmBox, scifSampleGroupEntry, scnmSampleGroupEntry, sdp_Box, sdtpBox, seigSampleGroupEntry, sencBox, sgpdBox, sidxBox, sinfBox, skipBox, slidBox, smhdBox, sratBox, ssixBox, stblBox, stcoBox, stdpBox, sterBox, sthdBox, stppSampleEntry, strdBox, striBox, strkBox, stsaSampleGroupEntry, stscBox, stsdBox, stsgBox, stshBox, stssBox, stszBox, sttsBox, stviBox, stxtSampleEntry, stypBox, stz2Box, subsBox, syncSampleGroupEntry, taicBox, taptBox, teleSampleGroupEntry, tencBox, tfdtBox, tfhdBox, tfraBox, tkhdBox, tmaxBox, tminBox, totlBox, tpayBox, tpylBox, trafBox, trakBox, trefBox, trepBox, trexBox, trgrBox, trpyBox, trunBox, tsasSampleGroupEntry, tsclSampleGroupEntry, tselBox, tsynBox, tx3gSampleEntry, txtcBox, tycoBox, udesBox, udtaBox, uncCBox, uncvSampleEntry, urlBox, urnBox, viprSampleGroupEntry, vmhdBox, vp08SampleEntry, vp09SampleEntry, vpcCBox, vttCBox, vttcBox, vvc1SampleEntry, vvcCBox, vvcNSampleEntry, vvi1SampleEntry, vvnCBox, vvs1SampleEntry, waveBox, wbbrBox, wvttSampleEntry, xmlBox };
}
//#endregion
//#region entries/types.d.ts
interface BoxRegistry<TBoxes = Partial<typeof all_boxes_d_exports>> {
  uuid: { [K in keyof TBoxes as TBoxes[K] extends {
    fourcc: 'uuid';
  } ? TBoxes[K] extends {
    uuid: infer TUuid;
  } ? TUuid extends string ? TUuid : never : never : never]: TBoxes[K] };
  sampleEntry: { [K in keyof TBoxes as TBoxes[K] extends {
    fourcc: infer TFourCC;
  } ? TBoxes[K] extends typeof SampleEntry ? TFourCC extends string ? TFourCC : never : never : never]: TBoxes[K] };
  sampleGroupEntry: { [K in keyof TBoxes as TBoxes[K] extends {
    grouping_type: infer G;
  } ? G extends string ? G : never : never]: TBoxes[K] };
  box: { [K in keyof TBoxes as TBoxes[K] extends {
    fourcc: 'uuid';
  } ? never : TBoxes[K] extends typeof SampleEntry ? never : TBoxes[K] extends typeof SampleGroupEntry ? never : TBoxes[K] extends {
    fourcc: infer TFourCC;
  } ? TFourCC extends string ? TFourCC : never : never]: TBoxes[K] };
}
type DescriptorRegistry = Partial<typeof descriptor_d_exports>;
type TypedArray<T extends ArrayBufferLike = ArrayBuffer> = Int8Array<T> | Uint8Array<T> | Uint8ClampedArray<T> | Int16Array<T> | Uint16Array<T> | Int32Array<T> | Uint32Array<T> | Float32Array<T> | Float64Array<T> | BigInt64Array<T> | BigUint64Array<T>;
type ValueOf<T> = T[keyof T];
type InstanceOf<T> = T extends (new (...args: Array<never>) => infer R) ? R : never;
type KindOf<T> = InstanceOf<ValueOf<T>>;
type Extends<TObject, TExtends> = { [TKey in keyof TObject]: TObject[TKey] extends TExtends ? TObject[TKey] : undefined }[keyof TObject];
type TupleOf<T, N extends number, R extends Array<T> = []> = R['length'] extends N ? R : TupleOf<T, N, [T, ...R]>;
type NumberTuple<T extends number> = TupleOf<number, T>;
type ConcreteBoxRegistry = BoxRegistry<typeof all_boxes_d_exports>;
type BoxFourCC = keyof ConcreteBoxRegistry['box'];
type SampleEntryFourCC = keyof ConcreteBoxRegistry['sampleEntry'];
type SampleGroupEntryGroupingType = keyof ConcreteBoxRegistry['sampleGroupEntry'];
type UUIDKeys = keyof ConcreteBoxRegistry['uuid'];
type AllIdentifiers = BoxFourCC | SampleEntryFourCC | SampleGroupEntryGroupingType | UUIDKeys;
type UUIDKind = InstanceOf<Extends<ConcreteBoxRegistry['uuid'], typeof Box>>;
type BoxKind = InstanceOf<Extends<ConcreteBoxRegistry['box'], typeof Box>>;
type SampleEntryKind = InstanceOf<Extends<ConcreteBoxRegistry['sampleEntry'], typeof SampleEntry>>;
type SampleGroupEntryKind = InstanceOf<Extends<ConcreteBoxRegistry['sampleGroupEntry'], typeof SampleGroupEntry>>;
type AllRegisteredBoxes = { [K in AllIdentifiers]: K extends keyof ConcreteBoxRegistry['box'] ? InstanceOf<ConcreteBoxRegistry['box'][K]> : K extends keyof ConcreteBoxRegistry['sampleEntry'] ? InstanceOf<ConcreteBoxRegistry['sampleEntry'][K]> : K extends keyof ConcreteBoxRegistry['sampleGroupEntry'] ? InstanceOf<ConcreteBoxRegistry['sampleGroupEntry'][K]> : K extends keyof ConcreteBoxRegistry['uuid'] ? InstanceOf<ConcreteBoxRegistry['uuid'][K]> : never };
interface FragmentedTrack<TUser> {
  id: number;
  user: TUser;
  trak: trakBox;
  segmentStream: DataStream;
  nb_samples: number;
  nb_samples_per_fragment: number;
  size_per_segment: number;
  rapAlignement: boolean;
  normalizeAudioSampleEntriesForMSE?: boolean;
  state: {
    lastFragmentSampleNumber: number;
    lastSegmentSampleNumber: number;
    accumulatedSize: number;
  };
}
interface SegmentationInitializationTrack<TUser> {
  id: number;
  user: TUser;
}
interface SegmentationInitialization<TUser> {
  tracks: Array<SegmentationInitializationTrack<TUser>>;
  buffer: ArrayBuffer;
}
interface SegmentationInitializationPerTrack<TUser> extends SegmentationInitializationTrack<TUser> {
  buffer: ArrayBuffer;
}
interface ExtractedTrack<TUser> {
  id: number;
  user: TUser;
  trak: trakBox;
  nb_samples: number;
  samples: Array<Sample>;
}
interface Sample {
  alreadyRead?: number;
  chunk_index?: number;
  chunk_run_index?: number;
  cts: number;
  data?: Uint8Array<ArrayBuffer>;
  degradation_priority: number;
  depends_on: number;
  description_index: number;
  description: Description['entries'][number];
  dts: number;
  duration: number;
  has_redundancy: number;
  is_depended_on: number;
  is_leading: number;
  is_sync: boolean;
  moof_number?: number;
  number_in_traf?: number;
  number: number;
  offset: number;
  pts?: number;
  sample_groups?: Array<SampleGroup>;
  size: number;
  subsamples?: Array<SubSample>;
  timescale: number;
  track_id: number;
}
interface SampleGroup {
  grouping_type: string;
  grouping_type_parameter: number;
  group_description_index?: number;
  description?: SampleEntry | SampleGroupEntry;
}
interface Track {
  alternate_group: number;
  audio?: {
    sample_rate: number;
    channel_count: number;
    sample_size: number;
  };
  bitrate: number;
  codec: string;
  created: Date;
  cts_shift: cslgBox;
  duration: number;
  edits?: Array<Entry>;
  id: number;
  kind: kindBox | {
    schemeURI: '';
    value: '';
  };
  language: string;
  layer: number;
  matrix: Matrix;
  modified: Date;
  movie_duration: number;
  movie_timescale: number;
  name: string;
  nb_samples: number;
  references: Array<{
    track_ids: ArrayLike<number>;
    type: string;
  }>;
  samples_duration: number;
  samples?: Array<Sample>;
  size: number;
  timescale: number;
  track_height: number;
  track_width: number;
  type?: 'audio' | 'video' | 'subtitles' | 'metadata';
  video?: {
    width: number;
    height: number;
  };
  volume: number;
}
interface Movie {
  hasMoov: boolean;
  audioTracks: Array<Track>;
  brands: Array<string>;
  created: Date;
  duration: number;
  fragment_duration?: {
    num: number;
    den: number;
  };
  hasIOD: boolean;
  hintTracks: Array<Track>;
  isFragmented: boolean;
  isProgressive: boolean;
  metadataTracks: Array<Track>;
  mime: string;
  modified: Date;
  otherTracks: Array<Track>;
  subtitleTracks: Array<Track>;
  timescale: number;
  tracks: Array<Track>;
  videoTracks: Array<Track>;
}
interface Description {
  default_group_description_index: number;
  entries: Array<SampleGroupEntry | SampleEntry>;
  used: boolean;
  version: number;
}
interface IncompleteBox {
  box?: Box;
  code: number;
  hdr_size?: number;
  size?: number;
  start?: number;
  type?: string;
  original_size?: number;
}
interface Item {
  alreadyRead?: number;
  content_encoding?: string;
  content_type?: string;
  item_uri_type: string;
  data?: Uint8Array;
  extents?: Array<{
    alreadyRead?: number;
    length: number;
    offset: number;
  }>;
  id?: number;
  name?: string;
  primary?: boolean;
  properties?: {
    boxes: Array<Box>;
  };
  protection?: sinfBox;
  ref_to?: Array<{
    type: string;
    id: Reference;
  }>;
  sent?: boolean;
  size?: number;
  source?: Box;
  type?: string;
}
interface EntityGroup {
  id: number;
  entity_ids: Array<number>;
  type: string;
  properties?: {
    boxes: Array<Box>;
  };
}
interface SubSample {
  size: number;
  priority: number;
  discardable: number;
  codec_specific_parameters: number;
}
type Matrix = Int32Array | Uint32Array | [number, number, number, number, number, number, number, number, number];
interface Nalu {
  data: Uint8Array;
  length?: number;
}
type NaluArray = Array<Nalu> & {
  completeness: number;
  nalu_type: number;
  length: number;
};
interface Output {
  log: (message: string) => void;
  indent: string;
}
interface Entry {
  segment_duration: number;
  media_time: number;
  media_rate_integer: number;
  media_rate_fraction: number;
}
interface Reference {
  to_item_ID: number;
}
/**********************************************************************************/
/**********************************************************************************/
type Charset = 'ASCII' | 'UTF-8' | 'UTF-16LE' | 'UTF-16BE' | 'ISO-8859-1' | 'ISO-8859-2' | 'ISO-8859-3' | 'ISO-8859-4' | 'ISO-8859-5' | 'ISO-8859-6' | 'ISO-8859-7' | 'ISO-8859-8' | 'ISO-8859-9' | 'ISO-8859-10' | 'ISO-8859-11' | 'ISO-8859-13' | 'ISO-8859-14' | 'ISO-8859-15' | 'ISO-8859-16' | 'Windows-1250' | 'Windows-1251' | 'Windows-1252' | 'Windows-1253' | 'Windows-1254' | 'Windows-1255' | 'Windows-1256' | 'Windows-1257' | 'Windows-1258' | 'KOI8-R' | 'KOI8-U' | 'Big5' | 'GBK' | 'GB18030' | 'Shift_JIS';
type SimpleNumberType = 'uint8' | 'uint16' | 'uint32' | 'int8' | 'int16' | 'int32' | 'float32' | 'float64';
type EndianNumberType = `${'uint' | 'int'}${32 | 16}${'le' | 'be'}` | `float${64 | 32}${'le' | 'be'}`;
type NumberType = SimpleNumberType | EndianNumberType;
type SimpleStringType = 'cstring' | 'string';
type EncodedStringType = `${SimpleStringType},${Charset}`;
type LengthStringType = `${SimpleStringType}:${number}`;
type EncodedLengthStringType = `${EncodedStringType}:${number}`;
type EndianStringType = `u16string${'' | 'le' | 'be'}:${number}`;
type StringType = SimpleStringType | EncodedStringType | LengthStringType | EncodedLengthStringType | EndianStringType;
interface GetterSetterType<T = any> {
  get(dataStream: DataStream, struct: Record<string, Type>): T;
  set?(dataStream: DataStream, value: T, struct?: Record<string, Type>): void;
}
type TupleType = ['[]', Type, (number | '*' | (string & {}) | ((struct: Record<string, Type>, dataStream: DataStream, type: Type) => number))];
type FnType = <T = unknown>(dataStream: DataStream, struct: T) => number;
type Type = NumberType | StringType | EndianNumberType | GetterSetterType | TupleType | FnType | StructDefinition;
type ParsedType = StructDefinition | TupleType | `cstring` | `string` | `u16string${'' | 'le' | 'be'}` | SimpleNumberType | EndianNumberType;
type StructDefinition = Array<[name: string, type: Type]>;
type ValueFromType<TValue extends Type> = TValue extends StringType ? string : TValue extends NumberType ? number : TValue extends FnType ? ReturnType<FnType> : TValue extends GetterSetterType ? ReturnType<TValue['get']> : TValue extends ['[]', NumberType, infer TAmount] ? TAmount extends number ? TupleOf<number, TAmount> : TAmount extends (() => infer TReturnType) ? TReturnType extends number ? TupleOf<number, TReturnType> : never : Array<number> : TValue extends StructDefinition ? StructDataFromStructDefinition<TValue> : never;
type StructDataFromStructDefinition<T extends StructDefinition> = { [TKey in T[number][0]]: Extract<T[number], [TKey, unknown]>[1] extends infer TValue ? TValue extends Type ? ValueFromType<TValue> : never : never };
//#endregion
//#region src/box-diff.d.ts
declare const DIFF_BOXES_PROP_NAMES: readonly ["boxes", "entries", "references", "subsamples", "items", "item_infos", "extents", "associations", "subsegments", "ranges", "seekLists", "seekPoints", "esd", "levels"];
declare const DIFF_PRIMITIVE_ARRAY_PROP_NAMES: readonly ["compatible_brands", "matrix", "opcolor", "sample_counts", "sample_deltas", "first_chunk", "samples_per_chunk", "sample_sizes", "chunk_offsets", "sample_offsets", "sample_description_index", "sample_duration"];
/** @bundle box-diff.js */
declare function boxEqualFields(box_a: Box, box_b: Box): boolean;
declare function boxEqual(box_a: Box, box_b: Box): boolean;
//#endregion
//#region src/create-file.d.ts
declare function createFile(keepMdatData?: boolean, stream?: MultiBufferStream): ISOFile<unknown, unknown>;
//#endregion
//#region src/log.d.ts
declare const Log: {
  setLogLevel(level: (module: string, msg?: string) => void): void;
  debug(module: string, msg?: string): void;
  log(module: {
    msg: string;
  }, _msg?: string): void;
  info(module: string, msg?: string): void;
  warn(module: string, msg?: string): void;
  error(module: string, msg?: string, isofile?: ISOFile): void;
  getDurationString(duration: number, _timescale?: number): string;
  printRanges(ranges: {
    length: number;
    start: (index: number) => number;
    end: (index: number) => number;
  }): string;
};
//#endregion
//#region src/text-mp4.d.ts
declare class VTTin4Parser {
  parseSample(data: TypedArray): Box[];
  getText(startTime: number, endTime: number, data: TypedArray): string;
}
declare class XMLSubtitlein4Parser {
  parseSample(sample: Sample): {
    resources: Array<Uint8Array>;
    documentString: string;
    document: undefined | Document;
  };
}
declare class Textin4Parser {
  parseSample(sample: Sample): string;
  parseConfig(data: TypedArray): string;
}
declare class TX3GParser {
  parseSample(sample: Sample): string;
}
//#endregion
//#region entries/all.d.ts
declare const BoxParser: BoxRegistry<typeof all_boxes_d_exports>;
//#endregion
export { SegmentationInitializationTrack as $, mecoBox as $t, GetterSetterType as A, SystemSampleEntry as An, Endianness as At, NumberTuple as B, freeBox as Bt, EndianStringType as C, tfhdBox as Cn, SampleGroupEntry as Ct, ExtractedTrack as D, MetadataSampleEntry as Dn, TrackReferenceTypeBox as Dt, Extends as E, HintSampleEntry as En, TrackGroupTypeBox as Et, LengthStringType as F, MP4BoxBuffer as Fn, ftypBox as Ft, Sample as G, idatBox as Gt, Output as H, hinfBox as Ht, Matrix as I, __exportAll as In, bxmlBox as It, SampleGroup as J, iproBox as Jt, SampleEntryFourCC as K, iodsBox as Kt, Movie as L, dinfBox as Lt, InstanceOf as M, VisualSampleEntry as Mn, IsoFileOptions as Mt, Item as N, mvhdBox as Nn, SampleGroupInfo as Nt, FnType as O, SampleEntry as On, MultiBufferStream as Ot, KindOf as P, mdhdBox as Pn, sidxBox as Pt, SegmentationInitializationPerTrack as Q, mdiaBox as Qt, Nalu as R, edtsBox as Rt, EndianNumberType as S, tkhdBox as Sn, FullBox as St, Entry as T, AudioSampleEntry as Tn, SingleItemTypeReferenceBoxLarge as Tt, ParsedType as U, hmhdBox as Ut, NumberType as V, grplBox as Vt, Reference as W, hntiBox as Wt, SampleGroupEntryKind as X, j2kHBox as Xt, SampleGroupEntryGroupingType as Y, iprpBox as Yt, SegmentationInitialization as Z, mdatBox as Zt, Charset as _, udtaBox as _n, emsgBox as _t, XMLSubtitlein4Parser as a, nmhdBox as an, SubSample as at, EncodedLengthStringType as b, mfhdBox as bn, MPEG4DescriptorParser as bt, DIFF_BOXES_PROP_NAMES as c, schiBox as cn, TupleType as ct, boxEqualFields as d, stblBox as dn, UUIDKeys as dt, mfraBox as en, SimpleNumberType as et, AllIdentifiers as f, strdBox as fn, UUIDKind as ft, BoxRegistry as g, trgrBox as gn, ssixBox as gt, BoxKind as h, trakBox as hn, stypBox as ht, VTTin4Parser as i, mvexBox as in, StructDefinition as it, IncompleteBox as j, TextSampleEntry as jn, ISOFile as jt, FragmentedTrack as k, SubtitleSampleEntry as kn, DataStream as kt, DIFF_PRIMITIVE_ARRAY_PROP_NAMES as l, sinfBox as ln, Type as lt, BoxFourCC as m, trafBox as mn, ValueOf as mt, TX3GParser as n, moofBox as nn, StringType as nt, Log as o, povdBox as on, Track as ot, AllRegisteredBoxes as p, strkBox as pn, ValueFromType as pt, SampleEntryKind as q, ipcoBox as qt, Textin4Parser as r, moovBox as rn, StructDataFromStructDefinition as rt, createFile as s, rinfBox as sn, TupleOf as st, BoxParser as t, minfBox as tn, SimpleStringType as tt, boxEqual as u, skipBox as un, TypedArray as ut, Description as v, vttcBox as vn, Descriptor as vt, EntityGroup as w, tfdtBox as wn, SingleItemTypeReferenceBox as wt, EncodedStringType as x, trunBox as xn, Box as xt, DescriptorRegistry as y, xmlBox as yn, ES_Descriptor as yt, NaluArray as z, etypBox as zt };
//# sourceMappingURL=all-CqMyB5Ns.d.cts.map