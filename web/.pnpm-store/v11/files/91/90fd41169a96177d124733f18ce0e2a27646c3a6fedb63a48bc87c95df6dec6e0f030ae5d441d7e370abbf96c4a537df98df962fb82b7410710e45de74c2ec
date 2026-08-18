Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_styp = require('./styp-CouZUj9h.cjs');

//#region src/descriptor.ts
var descriptor_exports = /* @__PURE__ */ require_styp.__exportAll({
	Descriptor: () => Descriptor,
	ES_Descriptor: () => ES_Descriptor,
	MPEG4DescriptorParser: () => MPEG4DescriptorParser
});
const ES_DescrTag = 3;
const DecoderConfigDescrTag = 4;
const DecSpecificInfoTag = 5;
const SLConfigDescrTag = 6;
var Descriptor = class Descriptor {
	constructor(tag, size) {
		this.tag = tag;
		this.size = size;
		this.descs = [];
	}
	parse(stream) {
		this.data = stream.readUint8Array(this.size);
	}
	findDescriptor(tag) {
		for (let i = 0; i < this.descs.length; i++) if (this.descs[i].tag === tag) return this.descs[i];
	}
	parseOneDescriptor(stream) {
		let size = 0;
		const tag = stream.readUint8();
		let byteRead = stream.readUint8();
		while (byteRead & 128) {
			size = (size << 7) + (byteRead & 127);
			byteRead = stream.readUint8();
		}
		size = (size << 7) + (byteRead & 127);
		require_styp.Log.debug("Descriptor", "Found " + (descTagToName[tag] || "Descriptor " + tag) + ", size " + size + " at position " + stream.getPosition());
		const desc = descTagToName[tag] ? new DESCRIPTOR_CLASSES[descTagToName[tag]](size) : new Descriptor(size);
		desc.parse(stream);
		return desc;
	}
	parseRemainingDescriptors(stream) {
		const start = stream.getPosition();
		while (stream.getPosition() < start + this.size) {
			const desc = this.parseOneDescriptor?.(stream);
			this.descs.push(desc);
		}
	}
};
var ES_Descriptor = class extends Descriptor {
	constructor(size) {
		super(ES_DescrTag, size);
	}
	parse(stream) {
		this.ES_ID = stream.readUint16();
		this.flags = stream.readUint8();
		this.size -= 3;
		if (this.flags & 128) {
			this.dependsOn_ES_ID = stream.readUint16();
			this.size -= 2;
		} else this.dependsOn_ES_ID = 0;
		if (this.flags & 64) {
			const l = stream.readUint8();
			this.URL = stream.readString(l);
			this.size -= l + 1;
		} else this.URL = "";
		if (this.flags & 32) {
			this.OCR_ES_ID = stream.readUint16();
			this.size -= 2;
		} else this.OCR_ES_ID = 0;
		this.parseRemainingDescriptors(stream);
	}
	getOTI() {
		const dcd = this.findDescriptor(DecoderConfigDescrTag);
		if (dcd) return dcd.oti;
		else return 0;
	}
	getAudioConfig() {
		const dcd = this.findDescriptor(DecoderConfigDescrTag);
		if (!dcd) return;
		const dsi = dcd.findDescriptor(DecSpecificInfoTag);
		if (dsi && dsi.data) {
			let audioObjectType = (dsi.data[0] & 248) >> 3;
			if (audioObjectType === 31 && dsi.data.length >= 2) audioObjectType = 32 + ((dsi.data[0] & 7) << 3) + ((dsi.data[1] & 224) >> 5);
			return audioObjectType;
		}
	}
};
var DecoderConfigDescriptor = class extends Descriptor {
	constructor(size) {
		super(DecoderConfigDescrTag, size);
	}
	parse(stream) {
		this.oti = stream.readUint8();
		this.streamType = stream.readUint8();
		this.upStream = (this.streamType >> 1 & 1) !== 0;
		this.streamType = this.streamType >>> 2;
		this.bufferSize = stream.readUint24();
		this.maxBitrate = stream.readUint32();
		this.avgBitrate = stream.readUint32();
		this.size -= 13;
		this.parseRemainingDescriptors(stream);
	}
};
var DecoderSpecificInfo = class extends Descriptor {
	constructor(size) {
		super(DecSpecificInfoTag, size);
	}
};
var SLConfigDescriptor = class extends Descriptor {
	constructor(size) {
		super(SLConfigDescrTag, size);
	}
};
const DESCRIPTOR_CLASSES = {
	Descriptor,
	ES_Descriptor,
	DecoderConfigDescriptor,
	DecoderSpecificInfo,
	SLConfigDescriptor
};
const descTagToName = {
	[ES_DescrTag]: "ES_Descriptor",
	[DecoderConfigDescrTag]: "DecoderConfigDescriptor",
	[DecSpecificInfoTag]: "DecoderSpecificInfo",
	[SLConfigDescrTag]: "SLConfigDescriptor"
};
var MPEG4DescriptorParser = class {
	constructor() {
		this.parseOneDescriptor = Descriptor.prototype.parseOneDescriptor;
	}
	getDescriptorName(tag) {
		return descTagToName[tag];
	}
};

//#endregion
//#region src/text-mp4.ts
var VTTin4Parser = class {
	parseSample(data) {
		const cues = [];
		const stream = new require_styp.MultiBufferStream(require_styp.MP4BoxBuffer.fromArrayBuffer(data.buffer, 0));
		while (!stream.isEof()) {
			const cue = require_styp.parseOneBox(stream, false);
			if (cue.code === 1 && cue.box?.type === "vttc") cues.push(cue.box);
		}
		return cues;
	}
	getText(startTime, endTime, data) {
		function pad(value, width) {
			const string = value.toString();
			if (string.length >= width) return string;
			return new Array(width - string.length + 1).join("0") + string;
		}
		function secToTimestamp(insec) {
			const h = Math.floor(insec / 3600);
			const m = Math.floor((insec - h * 3600) / 60);
			const s = Math.floor(insec - h * 3600 - m * 60);
			const ms = Math.floor((insec - h * 3600 - m * 60 - s) * 1e3);
			return "" + pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2) + "." + pad(ms, 3);
		}
		const cues = this.parseSample(data);
		let string = "";
		for (let i = 0; i < cues.length; i++) {
			const cueIn4 = cues[i];
			string += secToTimestamp(startTime) + " --> " + secToTimestamp(endTime) + "\r\n";
			string += cueIn4.payl.text;
		}
		return string;
	}
};
var XMLSubtitlein4Parser = class {
	parseSample(sample) {
		const res = {
			resources: [],
			documentString: "",
			document: void 0
		};
		const stream = new require_styp.DataStream(sample.data.buffer);
		if (!sample.subsamples || sample.subsamples.length === 0) res.documentString = stream.readString(sample.data.length);
		else {
			res.documentString = stream.readString(sample.subsamples[0].size);
			if (sample.subsamples.length > 1) for (let i = 1; i < sample.subsamples.length; i++) res.resources[i] = stream.readUint8Array(sample.subsamples[i].size);
		}
		if (typeof DOMParser !== "undefined") res.document = new DOMParser().parseFromString(res.documentString, "application/xml");
		return res;
	}
};
var Textin4Parser = class {
	parseSample(sample) {
		return new require_styp.DataStream(sample.data.buffer).readString(sample.data.length);
	}
	parseConfig(data) {
		const stream = new require_styp.DataStream(data.buffer);
		stream.readUint32();
		return stream.readCString();
	}
};
var TX3GParser = class {
	parseSample(sample) {
		const stream = new require_styp.DataStream(sample.data.buffer);
		const size = stream.readUint16();
		if (size === 0) return;
		return stream.readString(size);
	}
};

//#endregion
//#region src/boxes/a1lx.ts
var a1lxBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "AV1LayeredImageIndexingProperty";
	}
	static {
		this.fourcc = "a1lx";
	}
	parse(stream) {
		const FieldLength = ((stream.readUint8() & 1) + 1) * 16;
		this.layer_size = [];
		for (let i = 0; i < 3; i++) if (FieldLength === 16) this.layer_size[i] = stream.readUint16();
		else this.layer_size[i] = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/a1op.ts
var a1opBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "OperatingPointSelectorProperty";
	}
	static {
		this.fourcc = "a1op";
	}
	parse(stream) {
		this.op_index = stream.readUint8();
	}
};

//#endregion
//#region src/boxes/auxC.ts
var auxCBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "AuxiliaryTypeProperty";
	}
	static {
		this.fourcc = "auxC";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.aux_type = stream.readCString();
		const aux_subtype_length = this.size - this.hdr_size - (this.aux_type.length + 1);
		this.aux_subtype = stream.readUint8Array(aux_subtype_length);
	}
};

//#endregion
//#region src/boxes/btrt.ts
var btrtBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "BitRateBox";
	}
	static {
		this.fourcc = "btrt";
	}
	parse(stream) {
		this.bufferSizeDB = stream.readUint32();
		this.maxBitrate = stream.readUint32();
		this.avgBitrate = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/ccst.ts
var ccstBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CodingConstraintsBox";
	}
	static {
		this.fourcc = "ccst";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const flags = stream.readUint8();
		this.all_ref_pics_intra = (flags & 128) === 128;
		this.intra_pred_used = (flags & 64) === 64;
		this.max_ref_per_pic = (flags & 63) >> 2;
		stream.readUint24();
	}
};

//#endregion
//#region src/boxes/cdef.ts
var cdefBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ComponentDefinitionBox";
	}
	static {
		this.fourcc = "cdef";
	}
	parse(stream) {
		this.channel_count = stream.readUint16();
		this.channel_indexes = [];
		this.channel_types = [];
		this.channel_associations = [];
		for (let i = 0; i < this.channel_count; i++) {
			this.channel_indexes.push(stream.readUint16());
			this.channel_types.push(stream.readUint16());
			this.channel_associations.push(stream.readUint16());
		}
	}
};

//#endregion
//#region src/boxes/clap.ts
var clapBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CleanApertureBox";
	}
	static {
		this.fourcc = "clap";
	}
	parse(stream) {
		this.cleanApertureWidthN = stream.readUint32();
		this.cleanApertureWidthD = stream.readUint32();
		this.cleanApertureHeightN = stream.readUint32();
		this.cleanApertureHeightD = stream.readUint32();
		this.horizOffN = stream.readUint32();
		this.horizOffD = stream.readUint32();
		this.vertOffN = stream.readUint32();
		this.vertOffD = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/clli.ts
var clliBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ContentLightLevelBox";
	}
	static {
		this.fourcc = "clli";
	}
	parse(stream) {
		this.max_content_light_level = stream.readUint16();
		this.max_pic_average_light_level = stream.readUint16();
	}
};

//#endregion
//#region src/boxes/cmex.ts
var cmexBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CameraExtrinsicMatrixProperty";
	}
	static {
		this.fourcc = "cmex";
	}
	parse(stream) {
		if (this.flags & 1) this.pos_x = stream.readInt32();
		if (this.flags & 2) this.pos_y = stream.readInt32();
		if (this.flags & 4) this.pos_z = stream.readInt32();
		if (this.flags & 8) {
			if (this.version === 0) if (this.flags & 16) {
				this.quat_x = stream.readInt32();
				this.quat_y = stream.readInt32();
				this.quat_z = stream.readInt32();
			} else {
				this.quat_x = stream.readInt16();
				this.quat_y = stream.readInt16();
				this.quat_z = stream.readInt16();
			}
			else if (this.version === 1) {}
		}
		if (this.flags & 32) this.id = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/cmin.ts
var cminBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CameraIntrinsicMatrixProperty";
	}
	static {
		this.fourcc = "cmin";
	}
	parse(stream) {
		this.focal_length_x = stream.readInt32();
		this.principal_point_x = stream.readInt32();
		this.principal_point_y = stream.readInt32();
		if (this.flags & 1) {
			this.focal_length_y = stream.readInt32();
			this.skew_factor = stream.readInt32();
		}
	}
};

//#endregion
//#region src/boxes/cmpC.ts
var cmpCBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CompressionConfigurationBox";
	}
	static {
		this.fourcc = "cmpC";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.compression_type = stream.readString(4);
		this.compressed_unit_type = stream.readUint8();
	}
};

//#endregion
//#region src/boxes/cmpd.ts
var cmpdBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ComponentDefinitionBox";
	}
	static {
		this.fourcc = "cmpd";
	}
	parse(stream) {
		this.component_count = stream.readUint32();
		this.component_types = [];
		this.component_type_urls = [];
		for (let i = 0; i < this.component_count; i++) {
			const component_type = stream.readUint16();
			this.component_types.push(component_type);
			if (component_type >= 32768) this.component_type_urls.push(stream.readCString());
		}
	}
};

//#endregion
//#region src/boxes/co64.ts
var co64Box = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ChunkLargeOffsetBox";
	}
	static {
		this.fourcc = "co64";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const entry_count = stream.readUint32();
		this.chunk_offsets = [];
		if (this.version === 0) for (let i = 0; i < entry_count; i++) this.chunk_offsets.push(stream.readUint64());
	}
	/** @bundle writing/co64.js */
	write(stream) {
		this.version = 0;
		this.flags = 0;
		this.size = 4 + 8 * this.chunk_offsets.length;
		this.writeHeader(stream);
		stream.writeUint32(this.chunk_offsets.length);
		for (let i = 0; i < this.chunk_offsets.length; i++) stream.writeUint64(this.chunk_offsets[i]);
	}
};

//#endregion
//#region src/boxes/CoLL.ts
var CoLLBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ContentLightLevelBox";
	}
	static {
		this.fourcc = "CoLL";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.maxCLL = stream.readUint16();
		this.maxFALL = stream.readUint16();
	}
};

//#endregion
//#region src/boxes/covi.ts
var SphereRegion = class {
	toString() {
		let s = "centre_azimuth: ";
		s += this.centre_azimuth;
		s += " (";
		s += this.centre_azimuth * 2 ** -16;
		s += "°), centre_elevation: ";
		s += this.centre_elevation;
		s += " (";
		s += this.centre_elevation * 2 ** -16;
		s += "°), centre_tilt: ";
		s += this.centre_tilt;
		s += " (";
		s += this.centre_tilt * 2 ** -16;
		s += "°)";
		if (this.range_included_flag) {
			s += ", azimuth_range: ";
			s += this.azimuth_range;
			s += " (";
			s += this.azimuth_range * 2 ** -16;
			s += "°), elevation_range: ";
			s += this.elevation_range;
			s += " (";
			s += this.elevation_range * 2 ** -16;
			s += "°)";
		}
		if (this.interpolate_included_flag) {
			s += ", interpolate: ";
			s += this.interpolate;
		}
		return s;
	}
};
var CoverageSphereRegion = class {
	toString() {
		let s = "";
		if (this.view_idc) {
			s += "view_idc: ";
			s += this.view_idc;
			s += ", ";
		}
		s += "sphere_region: {";
		s += this.sphere_region;
		s += "}";
		return s;
	}
};
var coviBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CoverageInformationBox";
	}
	static {
		this.fourcc = "covi";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.coverage_shape_type = stream.readUint8();
		const num_regions = stream.readUint8();
		const f = stream.readInt8();
		const view_idc_presence_flag = f & 128;
		if (view_idc_presence_flag) this.default_view_idc = (f & 96) >> 5;
		this.coverage_regions = new Array();
		for (let i = 0; i < num_regions; i++) {
			const region = new CoverageSphereRegion();
			if (view_idc_presence_flag) region.view_idc = stream.readUint8() >> 6;
			region.sphere_region = this.parseSphereRegion(stream, true, true);
			this.coverage_regions.push(region);
		}
	}
	parseSphereRegion(stream, range_included_flag, interpolate_included_flag) {
		const sphere_region = new SphereRegion();
		sphere_region.centre_azimuth = stream.readInt32();
		sphere_region.centre_elevation = stream.readInt32();
		sphere_region.centre_tilt = stream.readInt32();
		sphere_region.range_included_flag = range_included_flag;
		if (range_included_flag) {
			sphere_region.azimuth_range = stream.readUint32();
			sphere_region.elevation_range = stream.readUint32();
		}
		sphere_region.interpolate_included_flag = interpolate_included_flag;
		if (interpolate_included_flag) sphere_region.interpolate = (stream.readUint8() & 128) === 128;
		return sphere_region;
	}
};

//#endregion
//#region src/boxes/cprt.ts
var cprtBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CopyrightBox";
	}
	static {
		this.fourcc = "cprt";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.parseLanguage(stream);
		this.notice = stream.readCString();
	}
};

//#endregion
//#region src/boxes/csch.ts
var cschBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CompatibleSchemeTypeBox";
	}
	static {
		this.fourcc = "csch";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.scheme_type = stream.readString(4);
		this.scheme_version = stream.readUint32();
		if (this.flags & 1) this.scheme_uri = stream.readCString();
	}
};

//#endregion
//#region src/boxes/cslg.ts
const INT32_MAX = 2147483647;
var cslgBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CompositionToDecodeBox";
	}
	static {
		this.fourcc = "cslg";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		if (this.version === 0) {
			this.compositionToDTSShift = stream.readInt32();
			this.leastDecodeToDisplayDelta = stream.readInt32();
			this.greatestDecodeToDisplayDelta = stream.readInt32();
			this.compositionStartTime = stream.readInt32();
			this.compositionEndTime = stream.readInt32();
		} else if (this.version === 1) {
			this.compositionToDTSShift = stream.readInt64();
			this.leastDecodeToDisplayDelta = stream.readInt64();
			this.greatestDecodeToDisplayDelta = stream.readInt64();
			this.compositionStartTime = stream.readInt64();
			this.compositionEndTime = stream.readInt64();
		}
	}
	/** @bundle writing/cslg.js */
	write(stream) {
		this.version = 0;
		if (this.compositionToDTSShift > INT32_MAX || this.leastDecodeToDisplayDelta > INT32_MAX || this.greatestDecodeToDisplayDelta > INT32_MAX || this.compositionStartTime > INT32_MAX || this.compositionEndTime > INT32_MAX) this.version = 1;
		this.flags = 0;
		if (this.version === 0) {
			this.size = 20;
			this.writeHeader(stream);
			stream.writeInt32(this.compositionToDTSShift);
			stream.writeInt32(this.leastDecodeToDisplayDelta);
			stream.writeInt32(this.greatestDecodeToDisplayDelta);
			stream.writeInt32(this.compositionStartTime);
			stream.writeInt32(this.compositionEndTime);
		} else if (this.version === 1) {
			this.size = 40;
			this.writeHeader(stream);
			stream.writeInt64(this.compositionToDTSShift);
			stream.writeInt64(this.leastDecodeToDisplayDelta);
			stream.writeInt64(this.greatestDecodeToDisplayDelta);
			stream.writeInt64(this.compositionStartTime);
			stream.writeInt64(this.compositionEndTime);
		}
	}
};

//#endregion
//#region src/boxes/ctts.ts
var cttsBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CompositionOffsetBox";
	}
	static {
		this.fourcc = "ctts";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const entry_count = stream.readUint32();
		this.sample_counts = [];
		this.sample_offsets = [];
		if (this.version === 0) for (let i = 0; i < entry_count; i++) {
			this.sample_counts.push(stream.readUint32());
			const value = stream.readInt32();
			if (value < 0) require_styp.Log.warn("BoxParser", "ctts box uses negative values without using version 1");
			this.sample_offsets.push(value);
		}
		else if (this.version === 1) for (let i = 0; i < entry_count; i++) {
			this.sample_counts.push(stream.readUint32());
			this.sample_offsets.push(stream.readInt32());
		}
	}
	/** @bundle writing/ctts.js */
	write(stream) {
		this.version = this.sample_offsets.some((offset) => offset < 0) ? 1 : 0;
		this.flags = 0;
		this.size = 4 + 8 * this.sample_counts.length;
		this.writeHeader(stream);
		stream.writeUint32(this.sample_counts.length);
		for (let i = 0; i < this.sample_counts.length; i++) {
			stream.writeUint32(this.sample_counts[i]);
			if (this.version === 1) stream.writeInt32(this.sample_offsets[i]);
			else stream.writeUint32(this.sample_offsets[i]);
		}
	}
	/** @bundle box-unpack.js */
	unpack(samples) {
		let k = 0;
		for (let i = 0; i < this.sample_counts.length; i++) for (let j = 0; j < this.sample_counts[i]; j++) {
			samples[k].pts = samples[k].dts + this.sample_offsets[i];
			k++;
		}
	}
};

//#endregion
//#region src/boxes/dac3.ts
var dac3Box = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "AC3SpecificBox";
	}
	static {
		this.fourcc = "dac3";
	}
	parse(stream) {
		const tmp_byte1 = stream.readUint8();
		const tmp_byte2 = stream.readUint8();
		const tmp_byte3 = stream.readUint8();
		this.fscod = tmp_byte1 >> 6;
		this.bsid = tmp_byte1 >> 1 & 31;
		this.bsmod = (tmp_byte1 & 1) << 2 | tmp_byte2 >> 6 & 3;
		this.acmod = tmp_byte2 >> 3 & 7;
		this.lfeon = tmp_byte2 >> 2 & 1;
		this.bit_rate_code = tmp_byte2 & 3 | tmp_byte3 >> 5 & 7;
	}
};

//#endregion
//#region src/boxes/dec3.ts
var dec3Box = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "EC3SpecificBox";
	}
	static {
		this.fourcc = "dec3";
	}
	parse(stream) {
		const tmp_16 = stream.readUint16();
		this.data_rate = tmp_16 >> 3;
		this.num_ind_sub = tmp_16 & 7;
		this.ind_subs = [];
		for (let i = 0; i < this.num_ind_sub + 1; i++) {
			const tmp_byte1 = stream.readUint8();
			const tmp_byte2 = stream.readUint8();
			const tmp_byte3 = stream.readUint8();
			const ind_sub = {
				fscod: tmp_byte1 >> 6,
				bsid: tmp_byte1 >> 1 & 31,
				bsmod: (tmp_byte1 & 1) << 4 | tmp_byte2 >> 4 & 15,
				acmod: tmp_byte2 >> 1 & 7,
				lfeon: tmp_byte2 & 1,
				num_dep_sub: tmp_byte3 >> 1 & 15
			};
			this.ind_subs.push(ind_sub);
			if (ind_sub.num_dep_sub > 0) ind_sub.chan_loc = (tmp_byte3 & 1) << 8 | stream.readUint8();
		}
	}
};

//#endregion
//#region src/boxes/dfLa.ts
var dfLaBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "FLACSpecificBox";
	}
	static {
		this.fourcc = "dfLa";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const BLOCKTYPE_MASK = 127;
		const LASTMETADATABLOCKFLAG_MASK = 128;
		const boxesFound = [];
		const knownBlockTypes = [
			"STREAMINFO",
			"PADDING",
			"APPLICATION",
			"SEEKTABLE",
			"VORBIS_COMMENT",
			"CUESHEET",
			"PICTURE",
			"RESERVED"
		];
		let flagAndType;
		do {
			flagAndType = stream.readUint8();
			const type = Math.min(flagAndType & BLOCKTYPE_MASK, knownBlockTypes.length - 1);
			if (!type) {
				stream.readUint8Array(13);
				this.samplerate = stream.readUint32() >> 12;
				stream.readUint8Array(20);
			} else stream.readUint8Array(stream.readUint24());
			boxesFound.push(knownBlockTypes[type]);
		} while (flagAndType & LASTMETADATABLOCKFLAG_MASK);
		this.numMetadataBlocks = boxesFound.length + " (" + boxesFound.join(", ") + ")";
	}
};

//#endregion
//#region src/boxes/dimm.ts
var dimmBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintimmediateBytesSent";
	}
	static {
		this.fourcc = "dimm";
	}
	parse(stream) {
		this.bytessent = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/dmax.ts
var dmax = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintlongestpacket";
	}
	static {
		this.fourcc = "dmax";
	}
	parse(stream) {
		this.time = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/dmed.ts
var dmedBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintmediaBytesSent";
	}
	static {
		this.fourcc = "dmed";
	}
	parse(stream) {
		this.bytessent = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/dOps.ts
var dOpsBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "OpusSpecificBox";
	}
	static {
		this.fourcc = "dOps";
	}
	parse(stream) {
		this.Version = stream.readUint8();
		this.OutputChannelCount = stream.readUint8();
		this.PreSkip = stream.readUint16();
		this.InputSampleRate = stream.readUint32();
		this.OutputGain = stream.readInt16();
		this.ChannelMappingFamily = stream.readUint8();
		if (this.ChannelMappingFamily !== 0) {
			this.StreamCount = stream.readUint8();
			this.CoupledCount = stream.readUint8();
			this.ChannelMapping = [];
			for (let i = 0; i < this.OutputChannelCount; i++) this.ChannelMapping[i] = stream.readUint8();
		}
	}
	write(stream) {
		this.size = 11;
		if (this.ChannelMappingFamily !== 0) this.size += 2 + this.OutputChannelCount;
		this.writeHeader(stream);
		stream.writeUint8(this.Version);
		stream.writeUint8(this.OutputChannelCount);
		stream.writeUint16(this.PreSkip);
		stream.writeUint32(this.InputSampleRate);
		stream.writeInt16(this.OutputGain);
		stream.writeUint8(this.ChannelMappingFamily);
		if (this.ChannelMappingFamily !== 0) {
			stream.writeUint8(this.StreamCount);
			stream.writeUint8(this.CoupledCount);
			for (let i = 0; i < this.OutputChannelCount; i++) stream.writeUint8(this.ChannelMapping[i]);
		}
	}
};

//#endregion
//#region src/boxes/drep.ts
var drepBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintrepeatedBytesSent";
	}
	static {
		this.fourcc = "drep";
	}
	parse(stream) {
		this.bytessent = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/elst.ts
var elstBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "EditListBox";
	}
	static {
		this.fourcc = "elst";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.entries = [];
		const entry_count = stream.readUint32();
		for (let i = 0; i < entry_count; i++) {
			const entry = {
				segment_duration: this.version === 1 ? stream.readUint64() : stream.readUint32(),
				media_time: this.version === 1 ? stream.readInt64() : stream.readInt32(),
				media_rate_integer: stream.readInt16(),
				media_rate_fraction: stream.readInt16()
			};
			this.entries.push(entry);
		}
	}
	/** @bundle writing/elst.js */
	write(stream) {
		const useVersion1 = this.entries.some((entry) => entry.segment_duration > require_styp.MAX_UINT32 || entry.media_time > require_styp.MAX_UINT32) || this.version === 1;
		this.version = useVersion1 ? 1 : 0;
		this.size = 4 + 12 * this.entries.length;
		this.size += useVersion1 ? 8 * this.entries.length : 0;
		this.writeHeader(stream);
		stream.writeUint32(this.entries.length);
		for (let i = 0; i < this.entries.length; i++) {
			const entry = this.entries[i];
			if (useVersion1) {
				stream.writeUint64(entry.segment_duration);
				stream.writeInt64(entry.media_time);
			} else {
				stream.writeUint32(entry.segment_duration);
				stream.writeInt32(entry.media_time);
			}
			stream.writeInt16(entry.media_rate_integer);
			stream.writeInt16(entry.media_rate_fraction);
		}
	}
};

//#endregion
//#region src/boxes/EntityToGroup/base.ts
var EntityToGroup = class extends require_styp.FullBox {
	parse(stream) {
		this.parseFullHeader(stream);
		this.group_id = stream.readUint32();
		this.num_entities_in_group = stream.readUint32();
		this.entity_ids = [];
		for (let i = 0; i < this.num_entities_in_group; i++) {
			const entity_id = stream.readUint32();
			this.entity_ids.push(entity_id);
		}
	}
};

//#endregion
//#region src/boxes/EntityToGroup/index.ts
var aebrBox = class extends EntityToGroup {
	constructor(..._args) {
		super(..._args);
		this.box_name = "Auto exposure bracketing";
	}
	static {
		this.fourcc = "aebr";
	}
};
var afbrBox = class extends EntityToGroup {
	constructor(..._args2) {
		super(..._args2);
		this.box_name = "Flash exposure information";
	}
	static {
		this.fourcc = "afbr";
	}
};
var albcBox = class extends EntityToGroup {
	constructor(..._args3) {
		super(..._args3);
		this.box_name = "Album collection";
	}
	static {
		this.fourcc = "albc";
	}
};
var altrBox = class extends EntityToGroup {
	constructor(..._args4) {
		super(..._args4);
		this.box_name = "Alternative entity";
	}
	static {
		this.fourcc = "altr";
	}
};
var brstBox = class extends EntityToGroup {
	constructor(..._args5) {
		super(..._args5);
		this.box_name = "Burst image";
	}
	static {
		this.fourcc = "brst";
	}
};
var dobrBox = class extends EntityToGroup {
	constructor(..._args6) {
		super(..._args6);
		this.box_name = "Depth of field bracketing";
	}
	static {
		this.fourcc = "dobr";
	}
};
var eqivBox = class extends EntityToGroup {
	constructor(..._args7) {
		super(..._args7);
		this.box_name = "Equivalent entity";
	}
	static {
		this.fourcc = "eqiv";
	}
};
var favcBox = class extends EntityToGroup {
	constructor(..._args8) {
		super(..._args8);
		this.box_name = "Favorites collection";
	}
	static {
		this.fourcc = "favc";
	}
};
var fobrBox = class extends EntityToGroup {
	constructor(..._args9) {
		super(..._args9);
		this.box_name = "Focus bracketing";
	}
	static {
		this.fourcc = "fobr";
	}
};
var iaugBox = class extends EntityToGroup {
	constructor(..._args10) {
		super(..._args10);
		this.box_name = "Image item with an audio track";
	}
	static {
		this.fourcc = "iaug";
	}
};
var panoBox = class extends EntityToGroup {
	constructor(..._args11) {
		super(..._args11);
		this.box_name = "Panorama";
	}
	static {
		this.fourcc = "pano";
	}
};
var slidBox = class extends EntityToGroup {
	constructor(..._args12) {
		super(..._args12);
		this.box_name = "Slideshow";
	}
	static {
		this.fourcc = "slid";
	}
};
var sterBox = class extends EntityToGroup {
	constructor(..._args13) {
		super(..._args13);
		this.box_name = "Stereo";
	}
	static {
		this.fourcc = "ster";
	}
};
var tsynBox = class extends EntityToGroup {
	constructor(..._args14) {
		super(..._args14);
		this.box_name = "Time-synchronized capture";
	}
	static {
		this.fourcc = "tsyn";
	}
};
var wbbrBox = class extends EntityToGroup {
	constructor(..._args15) {
		super(..._args15);
		this.box_name = "White balance bracketing";
	}
	static {
		this.fourcc = "wbbr";
	}
};
var prgrBox = class extends EntityToGroup {
	constructor(..._args16) {
		super(..._args16);
		this.box_name = "Progressive rendering";
	}
	static {
		this.fourcc = "prgr";
	}
};
var pymdBox = class extends EntityToGroup {
	constructor(..._args17) {
		super(..._args17);
		this.box_name = "Image pyramid";
	}
	static {
		this.fourcc = "pymd";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.group_id = stream.readUint32();
		this.num_entities_in_group = stream.readUint32();
		this.entity_ids = [];
		for (let i = 0; i < this.num_entities_in_group; i++) {
			const entity_id = stream.readUint32();
			this.entity_ids.push(entity_id);
		}
		this.tile_size_x = stream.readUint16();
		this.tile_size_y = stream.readUint16();
		this.layer_binning = [];
		this.tiles_in_layer_column_minus1 = [];
		this.tiles_in_layer_row_minus1 = [];
		for (let i = 0; i < this.num_entities_in_group; i++) {
			this.layer_binning[i] = stream.readUint16();
			this.tiles_in_layer_row_minus1[i] = stream.readUint16();
			this.tiles_in_layer_column_minus1[i] = stream.readUint16();
		}
	}
};

//#endregion
//#region src/boxes/fiel.ts
var fielBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "FieldHandlingBox";
	}
	static {
		this.fourcc = "fiel";
	}
	parse(stream) {
		this.fieldCount = stream.readUint8();
		this.fieldOrdering = stream.readUint8();
	}
};

//#endregion
//#region src/boxes/frma.ts
var frmaBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "OriginalFormatBox";
	}
	static {
		this.fourcc = "frma";
	}
	parse(stream) {
		this.data_format = stream.readString(4);
	}
};

//#endregion
//#region src/boxes/imir.ts
var imirBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ImageMirror";
	}
	static {
		this.fourcc = "imir";
	}
	parse(stream) {
		const tmp = stream.readUint8();
		this.reserved = tmp >> 7;
		this.axis = tmp & 1;
	}
};

//#endregion
//#region src/boxes/ipma.ts
var ipmaBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ItemPropertyAssociationBox";
	}
	static {
		this.fourcc = "ipma";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const entry_count = stream.readUint32();
		this.associations = [];
		for (let i = 0; i < entry_count; i++) {
			const id = this.version < 1 ? stream.readUint16() : stream.readUint32();
			const props = [];
			const association_count = stream.readUint8();
			for (let j = 0; j < association_count; j++) {
				const tmp = stream.readUint8();
				props.push({
					essential: (tmp & 128) >> 7 === 1,
					property_index: this.flags & 1 ? (tmp & 127) << 8 | stream.readUint8() : tmp & 127
				});
			}
			this.associations.push({
				id,
				props
			});
		}
	}
};

//#endregion
//#region src/boxes/irot.ts
var irotBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ImageRotation";
	}
	static {
		this.fourcc = "irot";
	}
	parse(stream) {
		this.angle = stream.readUint8() & 3;
	}
};

//#endregion
//#region src/boxes/ispe.ts
var ispeBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ImageSpatialExtentsProperty";
	}
	static {
		this.fourcc = "ispe";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.image_width = stream.readUint32();
		this.image_height = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/itai.ts
var itaiBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TAITimestampBox";
	}
	static {
		this.fourcc = "itai";
	}
	parse(stream) {
		this.TAI_timestamp = stream.readUint64();
		const status_bits = stream.readUint8();
		this.sychronization_state = status_bits >> 7 & 1;
		this.timestamp_generation_failure = status_bits >> 6 & 1;
		this.timestamp_is_modified = status_bits >> 5 & 1;
	}
};

//#endregion
//#region src/boxes/kind.ts
var kindBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "KindBox";
	}
	static {
		this.fourcc = "kind";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.schemeURI = stream.readCString();
		if (!this.isEndOfBox(stream)) this.value = stream.readCString();
	}
	/** @bundle writing/kind.js */
	write(stream) {
		this.version = 0;
		this.flags = 0;
		this.size = this.schemeURI.length + 1 + (this.value ? this.value.length + 1 : 0);
		this.writeHeader(stream);
		stream.writeCString(this.schemeURI);
		if (this.value) stream.writeCString(this.value);
	}
};

//#endregion
//#region src/boxes/leva.ts
var levaBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "LevelAssignmentBox";
	}
	static {
		this.fourcc = "leva";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const count = stream.readUint8();
		this.levels = [];
		for (let i = 0; i < count; i++) {
			const level = {};
			this.levels[i] = level;
			level.track_ID = stream.readUint32();
			const tmp_byte = stream.readUint8();
			level.padding_flag = tmp_byte >> 7;
			level.assignment_type = tmp_byte & 127;
			switch (level.assignment_type) {
				case 0:
					level.grouping_type = stream.readString(4);
					break;
				case 1:
					level.grouping_type = stream.readString(4);
					level.grouping_type_parameter = stream.readUint32();
					break;
				case 2: break;
				case 3: break;
				case 4:
					level.sub_track_id = stream.readUint32();
					break;
				default: require_styp.Log.warn("BoxParser", `Unknown level assignment type: ${level.assignment_type}`);
			}
		}
	}
};

//#endregion
//#region src/boxes/lhvC.ts
var lhvCBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "LHEVCConfigurationBox";
	}
	static {
		this.fourcc = "lhvC";
	}
	parse(stream) {
		this.configurationVersion = stream.readUint8();
		this.min_spatial_segmentation_idc = stream.readUint16() & 4095;
		this.parallelismType = stream.readUint8() & 3;
		let tmp_byte = stream.readUint8();
		this.numTemporalLayers = (tmp_byte & 13) >> 3;
		this.temporalIdNested = (tmp_byte & 4) >> 2;
		this.lengthSizeMinusOne = tmp_byte & 3;
		this.nalu_arrays = [];
		const numOfArrays = stream.readUint8();
		for (let i = 0; i < numOfArrays; i++) {
			const nalu_array = [];
			this.nalu_arrays.push(nalu_array);
			tmp_byte = stream.readUint8();
			nalu_array.completeness = (tmp_byte & 128) >> 7;
			nalu_array.nalu_type = tmp_byte & 63;
			const numNalus = stream.readUint16();
			for (let j = 0; j < numNalus; j++) {
				const length = stream.readUint16();
				nalu_array.push({ data: stream.readUint8Array(length) });
			}
		}
	}
};

//#endregion
//#region src/boxes/lsel.ts
var lselBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "LayerSelectorProperty";
	}
	static {
		this.fourcc = "lsel";
	}
	parse(stream) {
		this.layer_id = stream.readUint16();
	}
};

//#endregion
//#region src/boxes/maxr.ts
var maxrBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintmaxrate";
	}
	static {
		this.fourcc = "maxr";
	}
	parse(stream) {
		this.period = stream.readUint32();
		this.bytes = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/displays/colorPoint.ts
var ColorPoint = class {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
	toString() {
		return "(" + this.x + "," + this.y + ")";
	}
};

//#endregion
//#region src/boxes/mdcv.ts
var mdcvBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "MasteringDisplayColourVolumeBox";
	}
	static {
		this.fourcc = "mdcv";
	}
	parse(stream) {
		this.display_primaries = [];
		this.display_primaries[0] = new ColorPoint(stream.readUint16(), stream.readUint16());
		this.display_primaries[1] = new ColorPoint(stream.readUint16(), stream.readUint16());
		this.display_primaries[2] = new ColorPoint(stream.readUint16(), stream.readUint16());
		this.white_point = new ColorPoint(stream.readUint16(), stream.readUint16());
		this.max_display_mastering_luminance = stream.readUint32();
		this.min_display_mastering_luminance = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/mfro.ts
var mfroBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "MovieFragmentRandomAccessOffsetBox";
	}
	static {
		this.fourcc = "mfro";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this._size = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/mskC.ts
var mskCBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "MaskConfigurationProperty";
	}
	static {
		this.fourcc = "mskC";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.bits_per_pixel = stream.readUint8();
	}
};

//#endregion
//#region src/boxes/npck.ts
var npckBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintPacketsSent";
	}
	static {
		this.fourcc = "npck";
	}
	parse(stream) {
		this.packetssent = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/nump.ts
var numpBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintPacketsSent";
	}
	static {
		this.fourcc = "nump";
	}
	parse(stream) {
		this.packetssent = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/padb.ts
var PaddingBit = class {
	constructor(pad1, pad2) {
		this.pad1 = pad1;
		this.pad2 = pad2;
	}
};
var padbBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "PaddingBitsBox";
	}
	static {
		this.fourcc = "padb";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const sample_count = stream.readUint32();
		this.padbits = [];
		for (let i = 0; i < Math.floor((sample_count + 1) / 2); i++) {
			const bits = stream.readUint8();
			const pad1 = (bits & 112) >> 4;
			const pad2 = bits & 7;
			this.padbits.push(new PaddingBit(pad1, pad2));
		}
	}
};

//#endregion
//#region src/boxes/pasp.ts
var paspBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "PixelAspectRatioBox";
	}
	static {
		this.fourcc = "pasp";
	}
	parse(stream) {
		this.hSpacing = stream.readUint32();
		this.vSpacing = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/payl.ts
var paylBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CuePayloadBox";
	}
	static {
		this.fourcc = "payl";
	}
	parse(stream) {
		this.text = stream.readString(this.size - this.hdr_size);
	}
};

//#endregion
//#region src/boxes/payt.ts
var paytBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintpayloadID";
	}
	static {
		this.fourcc = "payt";
	}
	parse(stream) {
		this.payloadID = stream.readUint32();
		const count = stream.readUint8();
		this.rtpmap_string = stream.readString(count);
	}
};

//#endregion
//#region src/boxes/pdin.ts
var pdinBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ProgressiveDownloadInfoBox";
		this.rate = [];
		this.initial_delay = [];
	}
	static {
		this.fourcc = "pdin";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const count = (this.size - this.hdr_size) / 8;
		for (let i = 0; i < count; i++) {
			this.rate[i] = stream.readUint32();
			this.initial_delay[i] = stream.readUint32();
		}
	}
};

//#endregion
//#region src/boxes/pixi.ts
var pixiBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "PixelInformationProperty";
	}
	static {
		this.fourcc = "pixi";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.num_channels = stream.readUint8();
		this.bits_per_channels = [];
		for (let i = 0; i < this.num_channels; i++) this.bits_per_channels[i] = stream.readUint8();
	}
};

//#endregion
//#region src/boxes/pmax.ts
var pmaxBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintlargestpacket";
	}
	static {
		this.fourcc = "pmax";
	}
	parse(stream) {
		this.bytes = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/prdi.ts
var prdiBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ProgressiveDerivedImageItemInformationProperty";
	}
	static {
		this.fourcc = "prdi";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.step_count = stream.readUint16();
		this.item_count = [];
		if (this.flags & 2) for (let i = 0; i < this.step_count; i++) this.item_count[i] = stream.readUint16();
	}
};

//#endregion
//#region src/boxes/prfr.ts
var prfrBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ProjectionFormatBox";
	}
	static {
		this.fourcc = "prfr";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.projection_type = stream.readUint8() & 31;
	}
};

//#endregion
//#region src/boxes/prft.ts
var prftBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ProducerReferenceTimeBox";
	}
	static {
		this.fourcc = "prft";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.ref_track_id = stream.readUint32();
		this.ntp_timestamp = stream.readUint64();
		if (this.version === 0) this.media_time = stream.readUint32();
		else this.media_time = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/pssh.ts
var psshBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ProtectionSystemSpecificHeaderBox";
	}
	static {
		this.fourcc = "pssh";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.system_id = require_styp.parseHex16(stream);
		this.kid = [];
		if (this.version > 0) {
			const count = stream.readUint32();
			for (let i = 0; i < count; i++) this.kid[i] = require_styp.parseHex16(stream);
		}
		const datasize = stream.readUint32();
		if (datasize > 0) this.protection_data = stream.readUint8Array(datasize);
	}
};

//#endregion
//#region src/boxes/qt/clef.ts
var clefBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackCleanApertureDimensionsBox";
	}
	static {
		this.fourcc = "clef";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.width = stream.readUint32();
		this.height = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/qt/data.ts
function parseItifData(type, data) {
	if (type === dataBox.Types.UTF8) return new TextDecoder("utf-8").decode(data);
	const view = new DataView(data.buffer);
	if (type === dataBox.Types.BE_UNSIGNED_INT) if (data.length === 1) return view.getUint8(0);
	else if (data.length === 2) return view.getUint16(0, false);
	else if (data.length === 4) return view.getUint32(0, false);
	else if (data.length === 8) return view.getBigUint64(0, false);
	else throw new Error("Unsupported ITIF_TYPE_BE_UNSIGNED_INT length " + data.length);
	else if (type === dataBox.Types.BE_SIGNED_INT) if (data.length === 1) return view.getInt8(0);
	else if (data.length === 2) return view.getInt16(0, false);
	else if (data.length === 4) return view.getInt32(0, false);
	else if (data.length === 8) return view.getBigInt64(0, false);
	else throw new Error("Unsupported ITIF_TYPE_BE_SIGNED_INT length " + data.length);
	else if (type === dataBox.Types.BE_FLOAT32) return view.getFloat32(0, false);
	require_styp.Log.warn("DataBox", "Unsupported or unimplemented itif data type: " + type);
}
var dataBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "DataBox";
	}
	static {
		this.fourcc = "data";
	}
	static {
		this.Types = {
			RESERVED: 0,
			UTF8: 1,
			UTF16: 2,
			SJIS: 3,
			UTF8_SORT: 4,
			UTF16_SORT: 5,
			JPEG: 13,
			PNG: 14,
			BE_SIGNED_INT: 21,
			BE_UNSIGNED_INT: 22,
			BE_FLOAT32: 23,
			BE_FLOAT64: 24,
			BMP: 27,
			QT_ATOM: 28,
			BE_SIGNED_INT8: 65,
			BE_SIGNED_INT16: 66,
			BE_SIGNED_INT32: 67,
			BE_FLOAT32_POINT: 70,
			BE_FLOAT32_DIMENSIONS: 71,
			BE_FLOAT32_RECT: 72,
			BE_SIGNED_INT64: 74,
			BE_UNSIGNED_INT8: 75,
			BE_UNSIGNED_INT16: 76,
			BE_UNSIGNED_INT32: 77,
			BE_UNSIGNED_INT64: 78,
			BE_FLOAT64_AFFINE_TRANSFORM: 79
		};
	}
	parse(stream) {
		this.valueType = stream.readUint32();
		this.country = stream.readUint16();
		if (this.country > 255) {
			stream.seek(stream.getPosition() - 2);
			this.countryString = stream.readString(2);
		}
		this.language = stream.readUint16();
		if (this.language > 255) {
			stream.seek(stream.getPosition() - 2);
			this.parseLanguage(stream);
		}
		this.raw = stream.readUint8Array(this.size - this.hdr_size - 8);
		this.value = parseItifData(this.valueType, this.raw);
	}
};

//#endregion
//#region src/boxes/qt/enof.ts
var enofBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackEncodedPixelsDimensionsBox";
	}
	static {
		this.fourcc = "enof";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.width = stream.readUint32();
		this.height = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/qt/ilst.ts
var ilstBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "IlstBox";
	}
	static {
		this.fourcc = "ilst";
	}
	parse(stream) {
		this.list = {};
		let total = this.size - this.hdr_size;
		while (total > 0) {
			const size = stream.readUint32();
			const index = stream.readUint32();
			const res = require_styp.parseOneBox(stream, false, size - 8);
			if (res.code === 1) this.list[index] = res.box;
			total -= size;
		}
	}
};

//#endregion
//#region src/boxes/qt/keys.ts
var keysBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "KeysBox";
	}
	static {
		this.fourcc = "keys";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.count = stream.readUint32();
		this.keys = {};
		for (let i = 0; i < this.count; i++) {
			const len = stream.readUint32();
			this.keys[i + 1] = stream.readString(len - 4);
		}
	}
};

//#endregion
//#region src/boxes/qt/prof.ts
var profBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackProductionApertureDimensionsBox";
	}
	static {
		this.fourcc = "prof";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.width = stream.readUint32();
		this.height = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/qt/tapt.ts
var taptBox = class extends require_styp.ContainerBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackApertureModeDimensionsBox";
		this.clefs = [];
		this.profs = [];
		this.enofs = [];
		this.subBoxNames = [
			"clef",
			"prof",
			"enof"
		];
	}
	static {
		this.fourcc = "tapt";
	}
};

//#endregion
//#region src/boxes/rtp.ts
var rtp_Box = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "rtpmoviehintinformation";
	}
	static {
		this.fourcc = "rtp ";
	}
	parse(stream) {
		this.descriptionformat = stream.readString(4);
		this.sdptext = stream.readString(this.size - this.hdr_size - 4);
	}
};

//#endregion
//#region src/boxes/saio.ts
var saioBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SampleAuxiliaryInformationOffsetsBox";
	}
	static {
		this.fourcc = "saio";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		if (this.flags & 1) {
			this.aux_info_type = stream.readString(4);
			this.aux_info_type_parameter = stream.readUint32();
		}
		this.entry_count = stream.readUint32();
		this.offset = [];
		for (let i = 0; i < this.entry_count; i++) if (this.version === 0) this.offset[i] = stream.readUint32();
		else this.offset[i] = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/saiz.ts
var saizBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SampleAuxiliaryInformationSizesBox";
	}
	static {
		this.fourcc = "saiz";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		if (this.flags & 1) {
			this.aux_info_type = stream.readString(4);
			this.aux_info_type_parameter = stream.readUint32();
		}
		this.default_sample_info_size = stream.readUint8();
		this.sample_count = stream.readUint32();
		this.sample_info_size = [];
		if (this.default_sample_info_size === 0) for (let i = 0; i < this.sample_count; i++) this.sample_info_size[i] = stream.readUint8();
	}
};

//#endregion
//#region src/boxes/displays/pixel.ts
var Pixel = class {
	constructor(bad_pixel_row, bad_pixel_column) {
		this.bad_pixel_row = bad_pixel_row;
		this.bad_pixel_column = bad_pixel_column;
	}
	toString() {
		return "[row: " + this.bad_pixel_row + ", column: " + this.bad_pixel_column + "]";
	}
};

//#endregion
//#region src/boxes/sbpm.ts
var sbpmBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SensorBadPixelsMapBox";
	}
	static {
		this.fourcc = "sbpm";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.component_count = stream.readUint16();
		this.component_index = [];
		for (let i = 0; i < this.component_count; i++) this.component_index.push(stream.readUint16());
		const flags = stream.readUint8();
		this.correction_applied = 128 === (flags & 128);
		this.num_bad_rows = stream.readUint32();
		this.num_bad_cols = stream.readUint32();
		this.num_bad_pixels = stream.readUint32();
		this.bad_rows = [];
		this.bad_columns = [];
		this.bad_pixels = [];
		for (let i = 0; i < this.num_bad_rows; i++) this.bad_rows.push(stream.readUint32());
		for (let i = 0; i < this.num_bad_cols; i++) this.bad_columns.push(stream.readUint32());
		for (let i = 0; i < this.num_bad_pixels; i++) {
			const row = stream.readUint32();
			const col = stream.readUint32();
			this.bad_pixels.push(new Pixel(row, col));
		}
	}
};

//#endregion
//#region src/boxes/schm.ts
var schmBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SchemeTypeBox";
	}
	static {
		this.fourcc = "schm";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.scheme_type = stream.readString(4);
		this.scheme_version = stream.readUint32();
		if (this.flags & 1) this.scheme_uri = stream.readString(this.size - this.hdr_size - 8);
	}
};

//#endregion
//#region src/boxes/sdp.ts
var sdp_Box = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "rtptracksdphintinformation";
	}
	static {
		this.fourcc = "sdp ";
	}
	parse(stream) {
		this.sdptext = stream.readString(this.size - this.hdr_size);
	}
};

//#endregion
//#region src/boxes/senc.ts
var sencBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SampleEncryptionBox";
	}
	static {
		this.fourcc = "senc";
	}
};

//#endregion
//#region src/boxes/SmDm.ts
var SmDmBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SMPTE2086MasteringDisplayMetadataBox";
	}
	static {
		this.fourcc = "SmDm";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.primaryRChromaticity_x = stream.readUint16();
		this.primaryRChromaticity_y = stream.readUint16();
		this.primaryGChromaticity_x = stream.readUint16();
		this.primaryGChromaticity_y = stream.readUint16();
		this.primaryBChromaticity_x = stream.readUint16();
		this.primaryBChromaticity_y = stream.readUint16();
		this.whitePointChromaticity_x = stream.readUint16();
		this.whitePointChromaticity_y = stream.readUint16();
		this.luminanceMax = stream.readUint32();
		this.luminanceMin = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/srat.ts
var sratBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SamplingRateBox";
	}
	static {
		this.fourcc = "srat";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.sampling_rate = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/stdp.ts
var stdpBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "DegradationPriorityBox";
	}
	static {
		this.fourcc = "stdp";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const count = (this.size - this.hdr_size) / 2;
		this.priority = [];
		for (let i = 0; i < count; i++) this.priority[i] = stream.readUint16();
	}
};

//#endregion
//#region src/boxes/stri.ts
var striBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SubTrackInformationBox";
	}
	static {
		this.fourcc = "stri";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.switch_group = stream.readUint16();
		this.alternate_group = stream.readUint16();
		this.sub_track_id = stream.readUint32();
		const count = (this.size - this.hdr_size - 8) / 4;
		this.attribute_list = [];
		for (let i = 0; i < count; i++) this.attribute_list[i] = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/stsg.ts
var stsgBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SubTrackSampleGroupBox";
	}
	static {
		this.fourcc = "stsg";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.grouping_type = stream.readUint32();
		const count = stream.readUint16();
		this.group_description_index = [];
		for (let i = 0; i < count; i++) this.group_description_index[i] = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/stsh.ts
var stshBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "ShadowSyncSampleBox";
	}
	static {
		this.fourcc = "stsh";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const entry_count = stream.readUint32();
		this.shadowed_sample_numbers = [];
		this.sync_sample_numbers = [];
		if (this.version === 0) for (let i = 0; i < entry_count; i++) {
			this.shadowed_sample_numbers.push(stream.readUint32());
			this.sync_sample_numbers.push(stream.readUint32());
		}
	}
	write(stream) {
		this.version = 0;
		this.flags = 0;
		this.size = 4 + 8 * this.shadowed_sample_numbers.length;
		this.writeHeader(stream);
		stream.writeUint32(this.shadowed_sample_numbers.length);
		for (let i = 0; i < this.shadowed_sample_numbers.length; i++) {
			stream.writeUint32(this.shadowed_sample_numbers[i]);
			stream.writeUint32(this.sync_sample_numbers[i]);
		}
	}
};

//#endregion
//#region src/boxes/stss.ts
var stssBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SyncSampleBox";
	}
	static {
		this.fourcc = "stss";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const entry_count = stream.readUint32();
		if (this.version === 0) {
			this.sample_numbers = [];
			for (let i = 0; i < entry_count; i++) this.sample_numbers.push(stream.readUint32());
		}
	}
	/** @bundle writing/stss.js */
	write(stream) {
		this.version = 0;
		this.flags = 0;
		this.size = 4 + 4 * this.sample_numbers.length;
		this.writeHeader(stream);
		stream.writeUint32(this.sample_numbers.length);
		stream.writeUint32Array(this.sample_numbers);
	}
};

//#endregion
//#region src/boxes/stvi.ts
var stviBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "StereoVideoBox";
	}
	static {
		this.fourcc = "stvi";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const tmp32 = stream.readUint32();
		this.single_view_allowed = tmp32 & 3;
		this.stereo_scheme = stream.readUint32();
		const length = stream.readUint32();
		this.stereo_indication_type = stream.readString(length);
		this.boxes = [];
		while (stream.getPosition() < this.start + this.size) {
			const ret = require_styp.parseOneBox(stream, false, this.size - (stream.getPosition() - this.start));
			if (ret.code === 1) {
				const box = ret.box;
				this.boxes.push(box);
				this[box.type] = box;
			} else return;
		}
	}
};

//#endregion
//#region src/boxes/stz2.ts
var stz2Box = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "CompactSampleSizeBox";
	}
	static {
		this.fourcc = "stz2";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.sample_sizes = [];
		if (this.version === 0) {
			this.reserved = stream.readUint24();
			this.field_size = stream.readUint8();
			const sample_count = stream.readUint32();
			if (this.field_size === 4) for (let i = 0; i < sample_count; i += 2) {
				const tmp = stream.readUint8();
				this.sample_sizes[i] = tmp >> 4 & 15;
				this.sample_sizes[i + 1] = tmp & 15;
			}
			else if (this.field_size === 8) for (let i = 0; i < sample_count; i++) this.sample_sizes[i] = stream.readUint8();
			else if (this.field_size === 16) for (let i = 0; i < sample_count; i++) this.sample_sizes[i] = stream.readUint16();
			else require_styp.Log.error("BoxParser", "Error in length field in stz2 box", stream.isofile);
		}
	}
};

//#endregion
//#region src/boxes/subs.ts
var subsBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "SubSampleInformationBox";
	}
	static {
		this.fourcc = "subs";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const entry_count = stream.readUint32();
		this.entries = [];
		let subsample_count;
		for (let i = 0; i < entry_count; i++) {
			const sampleInfo = {};
			this.entries[i] = sampleInfo;
			sampleInfo.sample_delta = stream.readUint32();
			sampleInfo.subsamples = [];
			subsample_count = stream.readUint16();
			if (subsample_count > 0) for (let j = 0; j < subsample_count; j++) {
				const subsample = {};
				sampleInfo.subsamples.push(subsample);
				if (this.version === 1) subsample.size = stream.readUint32();
				else subsample.size = stream.readUint16();
				subsample.priority = stream.readUint8();
				subsample.discardable = stream.readUint8();
				subsample.codec_specific_parameters = stream.readUint32();
			}
		}
	}
};

//#endregion
//#region src/boxes/taic.ts
var taicBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TAIClockInfoBox";
	}
	static {
		this.fourcc = "taic";
	}
	parse(stream) {
		this.time_uncertainty = stream.readUint64();
		this.clock_resolution = stream.readUint32();
		this.clock_drift_rate = stream.readInt32();
		const reserved_byte = stream.readUint8();
		this.clock_type = (reserved_byte & 192) >> 6;
	}
};

//#endregion
//#region src/boxes/tenc.ts
var tencBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackEncryptionBox";
	}
	static {
		this.fourcc = "tenc";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		stream.readUint8();
		if (this.version === 0) stream.readUint8();
		else {
			const tmp = stream.readUint8();
			this.default_crypt_byte_block = tmp >> 4 & 15;
			this.default_skip_byte_block = tmp & 15;
		}
		this.default_isProtected = stream.readUint8();
		this.default_Per_Sample_IV_Size = stream.readUint8();
		this.default_KID = require_styp.parseHex16(stream);
		if (this.default_isProtected === 1 && this.default_Per_Sample_IV_Size === 0) {
			this.default_constant_IV_size = stream.readUint8();
			this.default_constant_IV = stream.readUint8Array(this.default_constant_IV_size);
		}
	}
};

//#endregion
//#region src/boxes/tfra.ts
var TfraEntry = class {};
var tfraBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackFragmentRandomAccessBox";
	}
	static {
		this.fourcc = "tfra";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.track_ID = stream.readUint32();
		stream.readUint24();
		const tmp_byte = stream.readUint8();
		this.length_size_of_traf_num = tmp_byte >> 4 & 3;
		this.length_size_of_trun_num = tmp_byte >> 2 & 3;
		this.length_size_of_sample_num = tmp_byte & 3;
		this.entries = [];
		const number_of_entries = stream.readUint32();
		for (let i = 0; i < number_of_entries; i++) {
			const entry = new TfraEntry();
			if (this.version === 1) {
				entry.time = stream.readUint64();
				entry.moof_offset = stream.readUint64();
			} else {
				entry.time = stream.readUint32();
				entry.moof_offset = stream.readUint32();
			}
			entry.traf_number = stream["readUint" + 8 * (this.length_size_of_traf_num + 1)]();
			entry.trun_number = stream["readUint" + 8 * (this.length_size_of_trun_num + 1)]();
			entry.sample_delta = stream["readUint" + 8 * (this.length_size_of_sample_num + 1)]();
			this.entries.push(entry);
		}
	}
};

//#endregion
//#region src/boxes/tmax.ts
var tmaxBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintmaxrelativetime";
	}
	static {
		this.fourcc = "tmax";
	}
	parse(stream) {
		this.time = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/tmin.ts
var tminBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintminrelativetime";
	}
	static {
		this.fourcc = "tmin";
	}
	parse(stream) {
		this.time = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/totl.ts
var totlBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintBytesSent";
	}
	static {
		this.fourcc = "totl";
	}
	parse(stream) {
		this.bytessent = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/tpay.ts
var tpayBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintBytesSent";
	}
	static {
		this.fourcc = "tpay";
	}
	parse(stream) {
		this.bytessent = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/tpyl.ts
var tpylBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintBytesSent";
	}
	static {
		this.fourcc = "tpyl";
	}
	parse(stream) {
		this.bytessent = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/trackgroups/msrc.ts
var msrcTrackGroupTypeBox = class extends require_styp.TrackGroupTypeBox {
	static {
		this.fourcc = "msrc";
	}
};

//#endregion
//#region src/boxes/tref.ts
var trefBox = class trefBox extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackReferenceBox";
		this.references = [];
	}
	static {
		this.fourcc = "tref";
	}
	static {
		this.allowed_types = [
			"hint",
			"cdsc",
			"font",
			"hind",
			"vdep",
			"vplx",
			"subt",
			"thmb",
			"auxl",
			"cdtg",
			"shsc",
			"aest"
		];
	}
	parse(stream) {
		while (stream.getPosition() < this.start + this.size) {
			const ret = require_styp.parseOneBox(stream, true, this.size - (stream.getPosition() - this.start));
			if (ret.code === 1) {
				if (!trefBox.allowed_types.includes(ret.type)) require_styp.Log.warn("BoxParser", `Unknown track reference type: '${ret.type}'`);
				const box = new require_styp.TrackReferenceTypeBox(ret.type, ret.size, ret.hdr_size, ret.start);
				if (box.write === require_styp.Box.prototype.write && box.type !== "mdat") {
					require_styp.Log.info("BoxParser", "TrackReference " + box.type + " box writing not yet implemented, keeping unparsed data in memory for later write");
					box.parseDataAndRewind(stream);
				}
				box.parse(stream);
				this.references.push(box);
			} else return;
		}
	}
};

//#endregion
//#region src/boxes/trep.ts
var trepBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackExtensionPropertiesBox";
	}
	static {
		this.fourcc = "trep";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.track_ID = stream.readUint32();
		this.boxes = [];
		while (stream.getPosition() < this.start + this.size) {
			const ret = require_styp.parseOneBox(stream, false, this.size - (stream.getPosition() - this.start));
			if (ret.code === 1) {
				const box = ret.box;
				this.boxes.push(box);
			} else return;
		}
	}
};

//#endregion
//#region src/boxes/trpy.ts
var trpyBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "hintBytesSent";
	}
	static {
		this.fourcc = "trpy";
	}
	parse(stream) {
		this.bytessent = stream.readUint64();
	}
};

//#endregion
//#region src/boxes/tsel.ts
var tselBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TrackSelectionBox";
	}
	static {
		this.fourcc = "tsel";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.switch_group = stream.readUint32();
		const count = (this.size - this.hdr_size - 4) / 4;
		this.attribute_list = [];
		for (let i = 0; i < count; i++) this.attribute_list[i] = stream.readUint32();
	}
};

//#endregion
//#region src/boxes/txtC.ts
var txtcBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TextConfigBox";
	}
	static {
		this.fourcc = "txtc";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.config = stream.readCString();
	}
};

//#endregion
//#region src/boxes/tyco.ts
var tycoBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "TypeCombinationBox";
	}
	static {
		this.fourcc = "tyco";
	}
	parse(stream) {
		const count = (this.size - this.hdr_size) / 4;
		this.compatible_brands = [];
		for (let i = 0; i < count; i++) this.compatible_brands[i] = stream.readString(4);
	}
};

//#endregion
//#region src/boxes/udes.ts
var udesBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "UserDescriptionProperty";
	}
	static {
		this.fourcc = "udes";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.lang = stream.readCString();
		this.name = stream.readCString();
		this.description = stream.readCString();
		this.tags = stream.readCString();
	}
};

//#endregion
//#region src/boxes/uncC.ts
var uncCBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "UncompressedFrameConfigBox";
	}
	static {
		this.fourcc = "uncC";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.profile = stream.readString(4);
		if (this.version === 1) {} else if (this.version === 0) {
			this.component_count = stream.readUint32();
			this.component_index = [];
			this.component_bit_depth_minus_one = [];
			this.component_format = [];
			this.component_align_size = [];
			for (let i = 0; i < this.component_count; i++) {
				this.component_index.push(stream.readUint16());
				this.component_bit_depth_minus_one.push(stream.readUint8());
				this.component_format.push(stream.readUint8());
				this.component_align_size.push(stream.readUint8());
			}
			this.sampling_type = stream.readUint8();
			this.interleave_type = stream.readUint8();
			this.block_size = stream.readUint8();
			const flags = stream.readUint8();
			this.component_little_endian = flags >> 7 & 1;
			this.block_pad_lsb = flags >> 6 & 1;
			this.block_little_endian = flags >> 5 & 1;
			this.block_reversed = flags >> 4 & 1;
			this.pad_unknown = flags >> 3 & 1;
			this.pixel_size = stream.readUint32();
			this.row_align_size = stream.readUint32();
			this.tile_align_size = stream.readUint32();
			this.num_tile_cols_minus_one = stream.readUint32();
			this.num_tile_rows_minus_one = stream.readUint32();
		}
	}
};

//#endregion
//#region src/boxes/urn.ts
var urnBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "DataEntryUrnBox";
	}
	static {
		this.fourcc = "urn ";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.name = stream.readCString();
		if (this.size - this.hdr_size - this.name.length - 1 > 0) this.location = stream.readCString();
	}
	/** @bundle writing/urn.js */
	write(stream) {
		this.version = 0;
		this.flags = 0;
		this.size = this.name.length + 1 + (this.location ? this.location.length + 1 : 0);
		this.writeHeader(stream);
		stream.writeCString(this.name);
		if (this.location) stream.writeCString(this.location);
	}
};

//#endregion
//#region src/boxes/vttC.ts
var vttCBox = class extends require_styp.Box {
	constructor(..._args) {
		super(..._args);
		this.box_name = "WebVTTConfigurationBox";
	}
	static {
		this.fourcc = "vttC";
	}
	parse(stream) {
		this.text = stream.readString(this.size - this.hdr_size);
	}
};

//#endregion
//#region src/boxes/vvnC.ts
var vvnCBox = class extends require_styp.FullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "VvcNALUConfigBox";
	}
	static {
		this.fourcc = "vvnC";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		const tmp = stream.readUint8();
		this.lengthSizeMinusOne = tmp & 3;
	}
};

//#endregion
//#region src/boxes/samplegroups/alst.ts
var alstSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "alst";
	}
	parse(stream) {
		const roll_count = stream.readUint16();
		this.first_output_sample = stream.readUint16();
		this.sample_offset = [];
		for (let i = 0; i < roll_count; i++) this.sample_offset[i] = stream.readUint32();
		const remaining = this.description_length - 4 - 4 * roll_count;
		this.num_output_samples = [];
		this.num_total_samples = [];
		for (let i = 0; i < remaining / 4; i++) {
			this.num_output_samples[i] = stream.readUint16();
			this.num_total_samples[i] = stream.readUint16();
		}
	}
};

//#endregion
//#region src/boxes/samplegroups/avll.ts
var avllSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "avll";
	}
	parse(stream) {
		this.layerNumber = stream.readUint8();
		this.accurateStatisticsFlag = stream.readUint8();
		this.avgBitRate = stream.readUint16();
		this.avgFrameRate = stream.readUint16();
	}
};

//#endregion
//#region src/boxes/samplegroups/avss.ts
var avssSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "avss";
	}
	parse(stream) {
		this.subSequenceIdentifier = stream.readUint16();
		this.layerNumber = stream.readUint8();
		const tmp_byte = stream.readUint8();
		this.durationFlag = tmp_byte >> 7;
		this.avgRateFlag = tmp_byte >> 6 & 1;
		if (this.durationFlag) this.duration = stream.readUint32();
		if (this.avgRateFlag) {
			this.accurateStatisticsFlag = stream.readUint8();
			this.avgBitRate = stream.readUint16();
			this.avgFrameRate = stream.readUint16();
		}
		this.dependency = [];
		const numReferences = stream.readUint8();
		for (let i = 0; i < numReferences; i++) this.dependency.push({
			subSeqDirectionFlag: stream.readUint8(),
			layerNumber: stream.readUint8(),
			subSequenceIdentifier: stream.readUint16()
		});
	}
};

//#endregion
//#region src/boxes/samplegroups/dtrt.ts
var dtrtSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "dtrt";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/mvif.ts
var mvifSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "mvif";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/prol.ts
var prolSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "prol";
	}
	parse(stream) {
		this.roll_distance = stream.readInt16();
	}
};

//#endregion
//#region src/boxes/samplegroups/rap.ts
var rapSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "rap ";
	}
	parse(stream) {
		const tmp_byte = stream.readUint8();
		this.num_leading_samples_known = tmp_byte >> 7;
		this.num_leading_samples = tmp_byte & 127;
	}
};

//#endregion
//#region src/boxes/samplegroups/rash.ts
var rashSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "rash";
	}
	parse(stream) {
		this.operation_point_count = stream.readUint16();
		if (this.description_length !== 2 + (this.operation_point_count === 1 ? 2 : this.operation_point_count * 6) + 9) {
			require_styp.Log.warn("BoxParser", "Mismatch in " + this.grouping_type + " sample group length");
			this.data = stream.readUint8Array(this.description_length - 2);
		} else {
			if (this.operation_point_count === 1) this.target_rate_share = stream.readUint16();
			else {
				this.target_rate_share = [];
				this.available_bitrate = [];
				for (let i = 0; i < this.operation_point_count; i++) {
					this.available_bitrate[i] = stream.readUint32();
					this.target_rate_share[i] = stream.readUint16();
				}
			}
			this.maximum_bitrate = stream.readUint32();
			this.minimum_bitrate = stream.readUint32();
			this.discard_priority = stream.readUint8();
		}
	}
};

//#endregion
//#region src/boxes/samplegroups/roll.ts
var rollSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "roll";
	}
	parse(stream) {
		this.roll_distance = stream.readInt16();
	}
};

//#endregion
//#region src/boxes/samplegroups/scif.ts
var scifSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "scif";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/scnm.ts
var scnmSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "scnm";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/seig.ts
var seigSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "seig";
	}
	parse(stream) {
		this.reserved = stream.readUint8();
		const tmp = stream.readUint8();
		this.crypt_byte_block = tmp >> 4;
		this.skip_byte_block = tmp & 15;
		this.isProtected = stream.readUint8();
		this.Per_Sample_IV_Size = stream.readUint8();
		this.KID = require_styp.parseHex16(stream);
		this.constant_IV_size = 0;
		this.constant_IV = 0;
		if (this.isProtected === 1 && this.Per_Sample_IV_Size === 0) {
			this.constant_IV_size = stream.readUint8();
			this.constant_IV = stream.readUint8Array(this.constant_IV_size);
		}
	}
};

//#endregion
//#region src/boxes/samplegroups/stsa.ts
var stsaSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "stsa";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/sync.ts
var syncSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "sync";
	}
	parse(stream) {
		const tmp_byte = stream.readUint8();
		this.NAL_unit_type = tmp_byte & 63;
	}
};

//#endregion
//#region src/boxes/samplegroups/tele.ts
var teleSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "tele";
	}
	parse(stream) {
		const tmp_byte = stream.readUint8();
		this.level_independently_decodable = tmp_byte >> 7;
	}
};

//#endregion
//#region src/boxes/samplegroups/tsas.ts
var tsasSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "tsas";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/tscl.ts
var tsclSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "tscl";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/samplegroups/vipr.ts
var viprSampleGroupEntry = class extends require_styp.SampleGroupEntry {
	static {
		this.grouping_type = "vipr";
	}
	parse(_stream) {
		require_styp.Log.warn("BoxParser", "Sample Group type: " + this.grouping_type + " not fully parsed");
	}
};

//#endregion
//#region src/boxes/uuid/index.ts
var UUIDBox = class extends require_styp.Box {
	static {
		this.fourcc = "uuid";
	}
};
var UUIDFullBox = class extends require_styp.FullBox {
	static {
		this.fourcc = "uuid";
	}
};
var piffLsmBox = class extends UUIDFullBox {
	constructor(..._args) {
		super(..._args);
		this.box_name = "LiveServerManifestBox";
	}
	static {
		this.uuid = "a5d40b30e81411ddba2f0800200c9a66";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.LiveServerManifest = stream.readString(this.size - this.hdr_size).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}
};
var piffPsshBox = class extends UUIDFullBox {
	constructor(..._args2) {
		super(..._args2);
		this.box_name = "PiffProtectionSystemSpecificHeaderBox";
	}
	static {
		this.uuid = "d08a4f1810f34a82b6c832d8aba183d3";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.system_id = require_styp.parseHex16(stream);
		const datasize = stream.readUint32();
		if (datasize > 0) this.data = stream.readUint8Array(datasize);
	}
};
var piffSencBox = class extends UUIDFullBox {
	constructor(..._args3) {
		super(..._args3);
		this.box_name = "PiffSampleEncryptionBox";
	}
	static {
		this.uuid = "a2394f525a9b4f14a2446c427c648df4";
	}
};
var piffTencBox = class extends UUIDFullBox {
	constructor(..._args4) {
		super(..._args4);
		this.box_name = "PiffTrackEncryptionBox";
	}
	static {
		this.uuid = "8974dbce7be74c5184f97148f9882554";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.default_AlgorithmID = stream.readUint24();
		this.default_IV_size = stream.readUint8();
		this.default_KID = require_styp.parseHex16(stream);
	}
};
var piffTfrfBox = class extends UUIDFullBox {
	constructor(..._args5) {
		super(..._args5);
		this.box_name = "TfrfBox";
	}
	static {
		this.uuid = "d4807ef2ca3946958e5426cb9e46a79f";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		this.fragment_count = stream.readUint8();
		this.entries = [];
		for (let i = 0; i < this.fragment_count; i++) {
			let absolute_time = 0;
			let absolute_duration = 0;
			if (this.version === 1) {
				absolute_time = stream.readUint64();
				absolute_duration = stream.readUint64();
			} else {
				absolute_time = stream.readUint32();
				absolute_duration = stream.readUint32();
			}
			this.entries.push({
				absolute_time,
				absolute_duration
			});
		}
	}
};
var piffTfxdBox = class extends UUIDFullBox {
	constructor(..._args6) {
		super(..._args6);
		this.box_name = "TfxdBox";
	}
	static {
		this.uuid = "6d1d9b0542d544e680e2141daff757b2";
	}
	parse(stream) {
		this.parseFullHeader(stream);
		if (this.version === 1) {
			this.absolute_time = stream.readUint64();
			this.duration = stream.readUint64();
		} else {
			this.absolute_time = stream.readUint32();
			this.duration = stream.readUint32();
		}
	}
};
var ItemContentIDPropertyBox = class extends UUIDBox {
	constructor(..._args7) {
		super(..._args7);
		this.box_name = "ItemContentIDProperty";
	}
	static {
		this.uuid = "261ef3741d975bbaacbd9d2c8ea73522";
	}
	parse(stream) {
		this.content_id = stream.readCString();
	}
};
var ItemComponentContentIDPropertyBox = class extends UUIDBox {
	constructor(..._args8) {
		super(..._args8);
		this.box_name = "ItemComponentContentIDProperty";
	}
	static {
		this.uuid = "9db9dd6e373c5a4e811021fc83a911fd";
	}
	parse(stream) {
		this.number_of_components = stream.readUint32();
		this.content_ids = [];
		for (let i = 0; i < this.number_of_components; i++) {
			const content_id = stream.readCString();
			this.content_ids.push(content_id);
		}
	}
};

//#endregion
//#region entries/all-boxes.ts
var all_boxes_exports = /* @__PURE__ */ require_styp.__exportAll({
	CoLLBox: () => CoLLBox,
	ItemComponentContentIDPropertyBox: () => ItemComponentContentIDPropertyBox,
	ItemContentIDPropertyBox: () => ItemContentIDPropertyBox,
	OpusSampleEntry: () => require_styp.OpusSampleEntry,
	SmDmBox: () => SmDmBox,
	a1lxBox: () => a1lxBox,
	a1opBox: () => a1opBox,
	ac_3SampleEntry: () => require_styp.ac_3SampleEntry,
	ac_4SampleEntry: () => require_styp.ac_4SampleEntry,
	aebrBox: () => aebrBox,
	afbrBox: () => afbrBox,
	albcBox: () => albcBox,
	alstSampleGroupEntry: () => alstSampleGroupEntry,
	altrBox: () => altrBox,
	auxCBox: () => auxCBox,
	av01SampleEntry: () => require_styp.av01SampleEntry,
	av1CBox: () => require_styp.av1CBox,
	avc1SampleEntry: () => require_styp.avc1SampleEntry,
	avc2SampleEntry: () => require_styp.avc2SampleEntry,
	avc3SampleEntry: () => require_styp.avc3SampleEntry,
	avc4SampleEntry: () => require_styp.avc4SampleEntry,
	avcCBox: () => require_styp.avcCBox,
	avllSampleGroupEntry: () => avllSampleGroupEntry,
	avs3SampleEntry: () => require_styp.avs3SampleEntry,
	avssSampleGroupEntry: () => avssSampleGroupEntry,
	brstBox: () => brstBox,
	btrtBox: () => btrtBox,
	bxmlBox: () => require_styp.bxmlBox,
	ccstBox: () => ccstBox,
	cdefBox: () => cdefBox,
	clapBox: () => clapBox,
	clefBox: () => clefBox,
	clliBox: () => clliBox,
	cmexBox: () => cmexBox,
	cminBox: () => cminBox,
	cmpCBox: () => cmpCBox,
	cmpdBox: () => cmpdBox,
	co64Box: () => co64Box,
	colrBox: () => require_styp.colrBox,
	coviBox: () => coviBox,
	cprtBox: () => cprtBox,
	cschBox: () => cschBox,
	cslgBox: () => cslgBox,
	cttsBox: () => cttsBox,
	dOpsBox: () => dOpsBox,
	dac3Box: () => dac3Box,
	dataBox: () => dataBox,
	dav1SampleEntry: () => require_styp.dav1SampleEntry,
	dec3Box: () => dec3Box,
	dfLaBox: () => dfLaBox,
	dimmBox: () => dimmBox,
	dinfBox: () => require_styp.dinfBox,
	dmax: () => dmax,
	dmedBox: () => dmedBox,
	dobrBox: () => dobrBox,
	drefBox: () => require_styp.drefBox,
	drepBox: () => drepBox,
	dtrtSampleGroupEntry: () => dtrtSampleGroupEntry,
	dvh1SampleEntry: () => require_styp.dvh1SampleEntry,
	dvheSampleEntry: () => require_styp.dvheSampleEntry,
	ec_3SampleEntry: () => require_styp.ec_3SampleEntry,
	edtsBox: () => require_styp.edtsBox,
	elngBox: () => require_styp.elngBox,
	elstBox: () => elstBox,
	emsgBox: () => require_styp.emsgBox,
	encaSampleEntry: () => require_styp.encaSampleEntry,
	encmSampleEntry: () => require_styp.encmSampleEntry,
	encsSampleEntry: () => require_styp.encsSampleEntry,
	enctSampleEntry: () => require_styp.enctSampleEntry,
	encuSampleEntry: () => require_styp.encuSampleEntry,
	encvSampleEntry: () => require_styp.encvSampleEntry,
	enofBox: () => enofBox,
	eqivBox: () => eqivBox,
	esdsBox: () => require_styp.esdsBox,
	etypBox: () => require_styp.etypBox,
	fLaCSampleEntry: () => require_styp.fLaCSampleEntry,
	favcBox: () => favcBox,
	fielBox: () => fielBox,
	fobrBox: () => fobrBox,
	freeBox: () => require_styp.freeBox,
	frmaBox: () => frmaBox,
	ftypBox: () => require_styp.ftypBox,
	grplBox: () => require_styp.grplBox,
	hdlrBox: () => require_styp.hdlrBox,
	hev1SampleEntry: () => require_styp.hev1SampleEntry,
	hev2SampleEntry: () => require_styp.hev2SampleEntry,
	hinfBox: () => require_styp.hinfBox,
	hmhdBox: () => require_styp.hmhdBox,
	hntiBox: () => require_styp.hntiBox,
	hvc1SampleEntry: () => require_styp.hvc1SampleEntry,
	hvc2SampleEntry: () => require_styp.hvc2SampleEntry,
	hvcCBox: () => require_styp.hvcCBox,
	hvt1SampleEntry: () => require_styp.hvt1SampleEntry,
	iaugBox: () => iaugBox,
	idatBox: () => require_styp.idatBox,
	iinfBox: () => require_styp.iinfBox,
	ilocBox: () => require_styp.ilocBox,
	ilstBox: () => ilstBox,
	imirBox: () => imirBox,
	infeBox: () => require_styp.infeBox,
	iodsBox: () => require_styp.iodsBox,
	ipcoBox: () => require_styp.ipcoBox,
	ipmaBox: () => ipmaBox,
	iproBox: () => require_styp.iproBox,
	iprpBox: () => require_styp.iprpBox,
	irefBox: () => require_styp.irefBox,
	irotBox: () => irotBox,
	ispeBox: () => ispeBox,
	itaiBox: () => itaiBox,
	j2kHBox: () => require_styp.j2kHBox,
	j2kiSampleEntry: () => require_styp.j2kiSampleEntry,
	keysBox: () => keysBox,
	kindBox: () => kindBox,
	levaBox: () => levaBox,
	lhe1SampleEntry: () => require_styp.lhe1SampleEntry,
	lhv1SampleEntry: () => require_styp.lhv1SampleEntry,
	lhvCBox: () => lhvCBox,
	lselBox: () => lselBox,
	lvc1SampleEntry: () => require_styp.lvc1SampleEntry,
	lvcCBox: () => require_styp.lvcCBox,
	m4aeSampleEntry: () => require_styp.m4aeSampleEntry,
	maxrBox: () => maxrBox,
	mdatBox: () => require_styp.mdatBox,
	mdcvBox: () => mdcvBox,
	mdhdBox: () => require_styp.mdhdBox,
	mdiaBox: () => require_styp.mdiaBox,
	mecoBox: () => require_styp.mecoBox,
	mehdBox: () => require_styp.mehdBox,
	metaBox: () => require_styp.metaBox,
	mettSampleEntry: () => require_styp.mettSampleEntry,
	metxSampleEntry: () => require_styp.metxSampleEntry,
	mfhdBox: () => require_styp.mfhdBox,
	mfraBox: () => require_styp.mfraBox,
	mfroBox: () => mfroBox,
	mha1SampleEntry: () => require_styp.mha1SampleEntry,
	mha2SampleEntry: () => require_styp.mha2SampleEntry,
	mhm1SampleEntry: () => require_styp.mhm1SampleEntry,
	mhm2SampleEntry: () => require_styp.mhm2SampleEntry,
	minfBox: () => require_styp.minfBox,
	mjp2SampleEntry: () => require_styp.mjp2SampleEntry,
	mjpgSampleEntry: () => require_styp.mjpgSampleEntry,
	moofBox: () => require_styp.moofBox,
	moovBox: () => require_styp.moovBox,
	mp4aSampleEntry: () => require_styp.mp4aSampleEntry,
	mp4sSampleEntry: () => require_styp.mp4sSampleEntry,
	mp4vSampleEntry: () => require_styp.mp4vSampleEntry,
	mskCBox: () => mskCBox,
	msrcTrackGroupTypeBox: () => msrcTrackGroupTypeBox,
	mvexBox: () => require_styp.mvexBox,
	mvhdBox: () => require_styp.mvhdBox,
	mvifSampleGroupEntry: () => mvifSampleGroupEntry,
	nmhdBox: () => require_styp.nmhdBox,
	npckBox: () => npckBox,
	numpBox: () => numpBox,
	padbBox: () => padbBox,
	panoBox: () => panoBox,
	paspBox: () => paspBox,
	paylBox: () => paylBox,
	paytBox: () => paytBox,
	pdinBox: () => pdinBox,
	piffLsmBox: () => piffLsmBox,
	piffPsshBox: () => piffPsshBox,
	piffSencBox: () => piffSencBox,
	piffTencBox: () => piffTencBox,
	piffTfrfBox: () => piffTfrfBox,
	piffTfxdBox: () => piffTfxdBox,
	pitmBox: () => require_styp.pitmBox,
	pixiBox: () => pixiBox,
	pmaxBox: () => pmaxBox,
	povdBox: () => require_styp.povdBox,
	prdiBox: () => prdiBox,
	prfrBox: () => prfrBox,
	prftBox: () => prftBox,
	prgrBox: () => prgrBox,
	profBox: () => profBox,
	prolSampleGroupEntry: () => prolSampleGroupEntry,
	psshBox: () => psshBox,
	pymdBox: () => pymdBox,
	rapSampleGroupEntry: () => rapSampleGroupEntry,
	rashSampleGroupEntry: () => rashSampleGroupEntry,
	resvSampleEntry: () => require_styp.resvSampleEntry,
	rinfBox: () => require_styp.rinfBox,
	rollSampleGroupEntry: () => rollSampleGroupEntry,
	rtp_Box: () => rtp_Box,
	saioBox: () => saioBox,
	saizBox: () => saizBox,
	sbgpBox: () => require_styp.sbgpBox,
	sbpmBox: () => sbpmBox,
	sbttSampleEntry: () => require_styp.sbttSampleEntry,
	schiBox: () => require_styp.schiBox,
	schmBox: () => schmBox,
	scifSampleGroupEntry: () => scifSampleGroupEntry,
	scnmSampleGroupEntry: () => scnmSampleGroupEntry,
	sdp_Box: () => sdp_Box,
	sdtpBox: () => require_styp.sdtpBox,
	seigSampleGroupEntry: () => seigSampleGroupEntry,
	sencBox: () => sencBox,
	sgpdBox: () => require_styp.sgpdBox,
	sidxBox: () => require_styp.sidxBox,
	sinfBox: () => require_styp.sinfBox,
	skipBox: () => require_styp.skipBox,
	slidBox: () => slidBox,
	smhdBox: () => require_styp.smhdBox,
	sratBox: () => sratBox,
	ssixBox: () => require_styp.ssixBox,
	stblBox: () => require_styp.stblBox,
	stcoBox: () => require_styp.stcoBox,
	stdpBox: () => stdpBox,
	sterBox: () => sterBox,
	sthdBox: () => require_styp.sthdBox,
	stppSampleEntry: () => require_styp.stppSampleEntry,
	strdBox: () => require_styp.strdBox,
	striBox: () => striBox,
	strkBox: () => require_styp.strkBox,
	stsaSampleGroupEntry: () => stsaSampleGroupEntry,
	stscBox: () => require_styp.stscBox,
	stsdBox: () => require_styp.stsdBox,
	stsgBox: () => stsgBox,
	stshBox: () => stshBox,
	stssBox: () => stssBox,
	stszBox: () => require_styp.stszBox,
	sttsBox: () => require_styp.sttsBox,
	stviBox: () => stviBox,
	stxtSampleEntry: () => require_styp.stxtSampleEntry,
	stypBox: () => require_styp.stypBox,
	stz2Box: () => stz2Box,
	subsBox: () => subsBox,
	syncSampleGroupEntry: () => syncSampleGroupEntry,
	taicBox: () => taicBox,
	taptBox: () => taptBox,
	teleSampleGroupEntry: () => teleSampleGroupEntry,
	tencBox: () => tencBox,
	tfdtBox: () => require_styp.tfdtBox,
	tfhdBox: () => require_styp.tfhdBox,
	tfraBox: () => tfraBox,
	tkhdBox: () => require_styp.tkhdBox,
	tmaxBox: () => tmaxBox,
	tminBox: () => tminBox,
	totlBox: () => totlBox,
	tpayBox: () => tpayBox,
	tpylBox: () => tpylBox,
	trafBox: () => require_styp.trafBox,
	trakBox: () => require_styp.trakBox,
	trefBox: () => trefBox,
	trepBox: () => trepBox,
	trexBox: () => require_styp.trexBox,
	trgrBox: () => require_styp.trgrBox,
	trpyBox: () => trpyBox,
	trunBox: () => require_styp.trunBox,
	tsasSampleGroupEntry: () => tsasSampleGroupEntry,
	tsclSampleGroupEntry: () => tsclSampleGroupEntry,
	tselBox: () => tselBox,
	tsynBox: () => tsynBox,
	tx3gSampleEntry: () => require_styp.tx3gSampleEntry,
	txtcBox: () => txtcBox,
	tycoBox: () => tycoBox,
	udesBox: () => udesBox,
	udtaBox: () => require_styp.udtaBox,
	uncCBox: () => uncCBox,
	uncvSampleEntry: () => require_styp.uncvSampleEntry,
	urlBox: () => require_styp.urlBox,
	urnBox: () => urnBox,
	viprSampleGroupEntry: () => viprSampleGroupEntry,
	vmhdBox: () => require_styp.vmhdBox,
	vp08SampleEntry: () => require_styp.vp08SampleEntry,
	vp09SampleEntry: () => require_styp.vp09SampleEntry,
	vpcCBox: () => require_styp.vpcCBox,
	vttCBox: () => vttCBox,
	vttcBox: () => require_styp.vttcBox,
	vvc1SampleEntry: () => require_styp.vvc1SampleEntry,
	vvcCBox: () => require_styp.vvcCBox,
	vvcNSampleEntry: () => require_styp.vvcNSampleEntry,
	vvi1SampleEntry: () => require_styp.vvi1SampleEntry,
	vvnCBox: () => vvnCBox,
	vvs1SampleEntry: () => require_styp.vvs1SampleEntry,
	waveBox: () => require_styp.waveBox,
	wbbrBox: () => wbbrBox,
	wvttSampleEntry: () => require_styp.wvttSampleEntry,
	xmlBox: () => require_styp.xmlBox
});

//#endregion
//#region entries/all.ts
const BoxParser = require_styp.registerBoxes(all_boxes_exports);
require_styp.registerDescriptors(descriptor_exports);

//#endregion
exports.AudioSampleEntry = require_styp.AudioSampleEntry;
exports.Box = require_styp.Box;
exports.BoxParser = BoxParser;
exports.DIFF_BOXES_PROP_NAMES = require_styp.DIFF_BOXES_PROP_NAMES;
exports.DIFF_PRIMITIVE_ARRAY_PROP_NAMES = require_styp.DIFF_PRIMITIVE_ARRAY_PROP_NAMES;
exports.DataStream = require_styp.DataStream;
exports.Descriptor = Descriptor;
exports.ES_Descriptor = ES_Descriptor;
exports.Endianness = require_styp.Endianness;
exports.FullBox = require_styp.FullBox;
exports.HintSampleEntry = require_styp.HintSampleEntry;
exports.ISOFile = require_styp.ISOFile;
exports.Log = require_styp.Log;
exports.MP4BoxBuffer = require_styp.MP4BoxBuffer;
exports.MPEG4DescriptorParser = MPEG4DescriptorParser;
exports.MetadataSampleEntry = require_styp.MetadataSampleEntry;
exports.MultiBufferStream = require_styp.MultiBufferStream;
exports.SampleEntry = require_styp.SampleEntry;
exports.SampleGroupEntry = require_styp.SampleGroupEntry;
exports.SampleGroupInfo = require_styp.SampleGroupInfo;
exports.SingleItemTypeReferenceBox = require_styp.SingleItemTypeReferenceBox;
exports.SingleItemTypeReferenceBoxLarge = require_styp.SingleItemTypeReferenceBoxLarge;
exports.SubtitleSampleEntry = require_styp.SubtitleSampleEntry;
exports.SystemSampleEntry = require_styp.SystemSampleEntry;
exports.TX3GParser = TX3GParser;
exports.TextSampleEntry = require_styp.TextSampleEntry;
exports.Textin4Parser = Textin4Parser;
exports.TrackGroupTypeBox = require_styp.TrackGroupTypeBox;
exports.TrackReferenceTypeBox = require_styp.TrackReferenceTypeBox;
exports.VTTin4Parser = VTTin4Parser;
exports.VisualSampleEntry = require_styp.VisualSampleEntry;
exports.XMLSubtitlein4Parser = XMLSubtitlein4Parser;
exports.boxEqual = require_styp.boxEqual;
exports.boxEqualFields = require_styp.boxEqualFields;
exports.createFile = require_styp.createFile;
//# sourceMappingURL=mp4box.all.cjs.map